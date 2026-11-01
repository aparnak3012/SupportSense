"""
SupportSense AI Service - FastAPI Application.

FastAPI: A modern, high-performance Python web framework for building APIs.
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import LLM_MODEL, ANTHROPIC_API_KEY, GEMINI_API_KEY, LLM_PROVIDER
from app.runtime_settings import get_threshold, set_threshold
from app.learner import learn_from_replies
from app.ingest import ingest_documents
from app.retriever import get_collection
from app.answerer import generate_answer
from app.summarizer import generate_summary
from app.tagger import classify_ticket
from app.gemini_client import generate_gemini_content
import anthropic

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("supportsense-ai")

app = FastAPI(
    title="SupportSense AI Service",
    description="Python AI service for chunking, vector embeddings, RAG answers, confidence scoring, auto-tagging, and summaries.",
    version="1.0.0"
)

# Enable CORS for local cross-service communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request and Response Models ---

class IngestResponse(BaseModel):
    chunks_stored: int = Field(..., description="Total number of chunks embedded and stored in ChromaDB")
    files_processed: List[str] = Field(..., description="List of document filenames processed")
    status: str = "success"


class AnswerRequest(BaseModel):
    ticket_text: str = Field(..., min_length=1, description="Customer question or support message")


class AnswerResponse(BaseModel):
    answer: str = Field(..., description="Grounded answer from docs or INSUFFICIENT_INFO")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Calculated final confidence score")
    sources: List[str] = Field(..., description="Names of source documents used")
    needs_human: bool = Field(..., description="True if confidence is below threshold or info is insufficient")
    retrieval_similarity: Optional[float] = None
    llm_self_confidence: Optional[float] = None


class SummarizeRequest(BaseModel):
    ticket_text: str = Field(..., min_length=1, description="Customer ticket content")
    attempted_answer: Optional[str] = Field("", description="Answer previously attempted by AI")


class SummarizeResponse(BaseModel):
    summary: str = Field(..., description="3-line briefing for the human support agent")


class TagRequest(BaseModel):
    ticket_text: str = Field(..., min_length=1, description="Customer ticket content")


class TagResponse(BaseModel):
    tags: List[str] = Field(..., description="1 to 3 categorized tags")
    urgency: str = Field(..., description="Urgency level: low | medium | high")


class InsightsRequest(BaseModel):
    total_tickets: int
    auto_resolved_pct: float
    escalated_pct: float
    top_tags: List[Dict[str, Any]]
    knowledge_gaps: List[Dict[str, Any]]
    avg_confidence: float


class InsightsResponse(BaseModel):
    insight: str


class ThresholdRequest(BaseModel):
    confidence_threshold: float = Field(..., ge=0.0, le=1.0)


class LearnItem(BaseModel):
    ticket_text: str
    human_reply: str


class LearnRequest(BaseModel):
    items: List[LearnItem]


# --- Endpoints ---

@app.get("/health", tags=["System"])
def health_check():
    """Health check endpoint reporting vector store status and configuration."""
    chunks_count = 0
    try:
        coll = get_collection()
        chunks_count = coll.count()
    except Exception:
        pass

    has_gemini = bool(GEMINI_API_KEY and not GEMINI_API_KEY.startswith("your_"))
    has_anthropic = bool(ANTHROPIC_API_KEY and not ANTHROPIC_API_KEY.startswith("your_"))

    return {
        "status": "ok",
        "service": "SupportSense AI Service",
        "llm_provider": LLM_PROVIDER,
        "model": LLM_MODEL,
        "confidence_threshold": get_threshold(),
        "has_gemini_key": has_gemini,
        "has_anthropic_key": has_anthropic,
        "has_active_key": (has_gemini or has_anthropic),
        "chroma_chunks": chunks_count,
    }


@app.post("/ingest", response_model=IngestResponse, tags=["Knowledge Base"])
def ingest():
    """
    Ingest help documents from data/docs.
    Splits into 500-char chunks with 50-char overlap, creates embeddings,
    and stores them in persistent local ChromaDB.
    """
    try:
        result = ingest_documents()
        return IngestResponse(**result)
    except Exception as e:
        logger.exception("Ingest failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/answer", response_model=AnswerResponse, tags=["RAG"])
def answer(req: AnswerRequest):
    """
    Search ChromaDB for top 4 chunks, prompt LLM to answer using ONLY those chunks,
    calculate confidence = 0.5 * retrieval + 0.5 * llm, and return recommendation.
    """
    try:
        result = generate_answer(req.ticket_text)
        return AnswerResponse(**result)
    except Exception as e:
        logger.exception("Answer generation failed: %s", e)
        # Error resilience: do not crash, mark as needs_human
        return AnswerResponse(
            answer="INSUFFICIENT_INFO",
            confidence=0.0,
            sources=[],
            needs_human=True,
            retrieval_similarity=0.0,
            llm_self_confidence=0.0,
        )


@app.post("/summarize", response_model=SummarizeResponse, tags=["Escalation"])
def summarize(req: SummarizeRequest):
    """Generate a 3-line escalation briefing for a human support agent."""
    try:
        summary_text = generate_summary(req.ticket_text, req.attempted_answer or "")
        return SummarizeResponse(summary=summary_text)
    except Exception as e:
        logger.exception("Summarization failed: %s", e)
        return SummarizeResponse(
            summary=(
                f"1. Customer Wants: Customer submitted ticket: '{req.ticket_text[:60]}...'\n"
                f"2. AI Attempted: Knowledge base check was inconclusive.\n"
                f"3. Suggested Next Step: Review order and respond to customer."
            )
        )


@app.post("/tag", response_model=TagResponse, tags=["Classification"])
def tag(req: TagRequest):
    """Classify ticket into 1 to 3 tags from allowed list and determine urgency."""
    try:
        result = classify_ticket(req.ticket_text)
        return TagResponse(**result)
    except Exception as e:
        logger.exception("Tagging failed: %s", e)
        return TagResponse(tags=["other"], urgency="low")


@app.post("/settings/threshold", tags=["Model Update"])
def update_threshold(req: ThresholdRequest):
    """Persist a new confidence threshold (clamped to 0.5-0.8); used by the next /answer call."""
    return {"confidence_threshold": set_threshold(req.confidence_threshold)}


@app.post("/learn", tags=["Model Update"])
def learn(req: LearnRequest):
    """Add human agent replies to the knowledge base and re-ingest it."""
    try:
        return learn_from_replies([item.model_dump() for item in req.items])
    except Exception as e:
        logger.exception("Learning failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/insights", response_model=InsightsResponse, tags=["Reports"])
def generate_insights(metrics: InsightsRequest):
    """Generate plain-English analytical insights for the weekly support report."""
    prompt = f"""You are a customer operations analyst.
Given these weekly support numbers:
- Total tickets: {metrics.total_tickets}
- Auto-resolved: {metrics.auto_resolved_pct}%
- Escalated to human: {metrics.escalated_pct}%
- Average confidence: {metrics.avg_confidence}
- Top ticket tags: {metrics.top_tags}
- Knowledge gaps (tags escalated most frequently): {metrics.knowledge_gaps}

Write 2 concise paragraphs of plain-English operational insight:
1. What went well this week and the biggest customer driver.
2. The #1 documentation or process gap that should be updated to reduce escalations next week.
Keep it practical, professional, and directly tied to the numbers."""

    if LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
        try:
            insight_res = generate_gemini_content(
                prompt=prompt,
                model=LLM_MODEL,
                api_key=GEMINI_API_KEY,
                max_tokens=1500
            )
            return InsightsResponse(insight=insight_res.strip())
        except Exception as e:
            logger.error("Failed to generate insights via Gemini: %s", e)
    elif LLM_PROVIDER == "anthropic" and ANTHROPIC_API_KEY and not ANTHROPIC_API_KEY.startswith("your_"):
        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=LLM_MODEL,
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}]
            )
            return InsightsResponse(insight=response.content[0].text.strip())
        except Exception as e:
            logger.error("Failed to generate insights via Anthropic: %s", e)

    # Fallback analytical text
    gap_names = ", ".join([g.get("tag", "unknown") for g in metrics.knowledge_gaps[:2]]) or "general issues"
    top_tag_name = metrics.top_tags[0]["tag"] if metrics.top_tags else "inquiries"
    insight_text = (
        f"This week processed {metrics.total_tickets} tickets with an auto-resolution rate of "
        f"{metrics.auto_resolved_pct:.1f}% and an average confidence score of {metrics.avg_confidence:.2f}. "
        f"The primary driver of customer contacts was '{top_tag_name}'.\n\n"
        f"The primary knowledge gaps identified were '{gap_names}', which had the highest human escalation rates. "
        f"Updating help documentation around these specific topics will yield the largest reduction in agent ticket backlog."
    )
    return InsightsResponse(insight=insight_text)

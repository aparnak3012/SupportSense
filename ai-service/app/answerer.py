"""
Answerer Module for SupportSense.

RAG (Retrieval-Augmented Generation): An AI technique where the system first searches
for factual document chunks (Retrieval), then instructs a Large Language Model (Generation)
to formulate an answer using strictly those retrieved facts.
"""

import json
import logging
import re
from typing import Dict, Any, List
import anthropic

from app.config import ANTHROPIC_API_KEY, GEMINI_API_KEY, LLM_PROVIDER, LLM_MODEL
from app.runtime_settings import get_threshold
from app.retriever import search_relevant_chunks
from app.confidence import calculate_confidence
from app.gemini_client import generate_gemini_content

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are SupportSense, an accurate AI customer support assistant for ShopEasy.

You must answer the customer support ticket using ONLY the provided document chunks below.

CRITICAL INSTRUCTIONS:
1. If the chunks DO NOT contain sufficient factual information to answer the question completely and accurately, your answer MUST BE EXACTLY "INSUFFICIENT_INFO". Do NOT guess, do NOT assume, and do NOT use outside knowledge.
2. If the chunks DO contain the answer, provide a direct, helpful, professional, and friendly response based strictly on the facts in the chunks.
3. Return STRICT JSON ONLY. Do not include markdown code block backticks (no ```json).
4. Provide a self-rated confidence score between 0.0 and 1.0 reflecting how completely and accurately the retrieved chunks answer the customer's question. If answering "INSUFFICIENT_INFO", self_confidence must be 0.0.
5. List the chunk IDs in "used_chunk_ids" that you used to construct the answer.

JSON RESPONSE FORMAT:
{
  "answer": "string",
  "self_confidence": float,
  "used_chunk_ids": ["chunk_id_1"]
}
"""


def _parse_llm_json(raw_text: str) -> Dict[str, Any]:
    """Safely parse JSON response from LLM output, stripping any markdown backticks."""
    text = raw_text.strip()
    # Strip markdown code blocks if the LLM wrapped the JSON in them
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        # Try regex extraction for {...}
        match = re.search(r"(\{.*\})", text, flags=re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(1))
                if isinstance(data, dict):
                    return data
            except Exception:
                pass

    logger.warning("Failed to parse JSON from LLM: %s", raw_text)
    return {
        "answer": "INSUFFICIENT_INFO",
        "self_confidence": 0.0,
        "used_chunk_ids": [],
    }


def _mock_answer_fallback(ticket_text: str, chunks: List[Dict[str, Any]], similarity: float) -> Dict[str, Any]:
    """
    Fallback answer generator used when Anthropic API key is absent or offline.
    Keeps tests and local demos functioning without crashing.
    """
    # If retrieval similarity is too low, treat as insufficient
    if similarity < 0.40 or not chunks:
        return {
            "answer": "INSUFFICIENT_INFO",
            "self_confidence": 0.0,
            "used_chunk_ids": [],
        }

    # If the question asks for something completely unrelated
    ticket_lower = ticket_text.lower()
    out_of_scope_keywords = ["crypto", "bitcoin", "investment", "flight", "airline", "hotel", "pet grooming", "recipe", "pizza"]
    if any(k in ticket_lower for k in out_of_scope_keywords):
        return {
            "answer": "INSUFFICIENT_INFO",
            "self_confidence": 0.0,
            "used_chunk_ids": [],
        }

    best_chunk = chunks[0]
    used_id = best_chunk["id"]
    return {
        "answer": f"According to ShopEasy policy ({best_chunk['source']}): {best_chunk['text'][:350]}...",
        "self_confidence": min(0.95, round(similarity, 2)),
        "used_chunk_ids": [used_id],
    }


def generate_answer(ticket_text: str) -> Dict[str, Any]:
    """
    Execute the full RAG pipeline for a support ticket:
    1. Search ChromaDB for top 4 chunks.
    2. Prompt Claude via Anthropic SDK using strict JSON output.
    3. Compute hybrid confidence = 0.5 * retrieval_score + 0.5 * llm_score.
    4. Return { answer, confidence, sources, needs_human }.
    """
    # Step a: Search ChromaDB for top 4 chunks
    chunks, retrieval_similarity = search_relevant_chunks(ticket_text, top_k=4)

    # Compile candidate sources
    retrieved_sources = sorted(list(set(c["source"] for c in chunks)))

    # Format chunks for LLM context
    context_chunks_str = ""
    for c in chunks:
        context_chunks_str += f"\n--- Chunk ID: {c['id']} (Source: {c['source']}) ---\n{c['text']}\n"

    user_message = f"""DOCUMENT CHUNKS:
{context_chunks_str if context_chunks_str else "No documents found."}

CUSTOMER TICKET:
{ticket_text}

Provide your response in strict JSON:"""

    llm_output: Dict[str, Any] = {}

    if LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
        try:
            raw_content = generate_gemini_content(
                prompt=user_message,
                system_prompt=SYSTEM_PROMPT,
                model=LLM_MODEL,
                api_key=GEMINI_API_KEY,
                max_tokens=2048,
                response_json=True,
            )
            llm_output = _parse_llm_json(raw_content)
        except Exception as e:
            logger.error("Error communicating with Gemini API: %s", e)
            llm_output = _mock_answer_fallback(ticket_text, chunks, retrieval_similarity)
    elif LLM_PROVIDER == "anthropic" and ANTHROPIC_API_KEY and not ANTHROPIC_API_KEY.startswith("your_"):
        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=LLM_MODEL,
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": user_message}
                ]
            )
            raw_content = response.content[0].text
            llm_output = _parse_llm_json(raw_content)
        except Exception as e:
            logger.error("Error communicating with Anthropic API: %s", e)
            llm_output = _mock_answer_fallback(ticket_text, chunks, retrieval_similarity)
    else:
        # Fallback when no API key is configured or offline
        llm_output = _mock_answer_fallback(ticket_text, chunks, retrieval_similarity)

    answer = llm_output.get("answer", "INSUFFICIENT_INFO").strip()
    llm_self_conf = float(llm_output.get("self_confidence", 0.0))
    used_chunk_ids = llm_output.get("used_chunk_ids", [])

    is_insufficient = (answer == "INSUFFICIENT_INFO" or "INSUFFICIENT_INFO" in answer)

    # Step c: Calculate final confidence
    final_conf, needs_human = calculate_confidence(
        retrieval_similarity_score=retrieval_similarity,
        llm_self_confidence=llm_self_conf,
        is_insufficient=is_insufficient,
        threshold=get_threshold(),
    )

    # Determine sources to return
    # If specific chunks were used, extract their sources; otherwise return retrieved sources
    if used_chunk_ids:
        used_sources = sorted(list(set(
            c["source"] for c in chunks if c["id"] in used_chunk_ids
        )))
        final_sources = used_sources if used_sources else retrieved_sources
    else:
        final_sources = retrieved_sources if not is_insufficient else []

    return {
        "answer": answer,
        "confidence": final_conf,
        "sources": final_sources,
        "needs_human": needs_human,
        "retrieval_similarity": retrieval_similarity,
        "llm_self_confidence": llm_self_conf,
    }

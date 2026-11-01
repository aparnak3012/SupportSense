"""
Summarizer Module for SupportSense.

Summarization: Distilling a customer's issue and previous automated attempts
into a concise briefing for a human support agent.
"""

import logging
from typing import Dict, Any
import anthropic

from app.config import ANTHROPIC_API_KEY, GEMINI_API_KEY, LLM_PROVIDER, LLM_MODEL
from app.gemini_client import generate_gemini_content

logger = logging.getLogger(__name__)

SUMMARIZER_PROMPT = """You are an escalation assistant for human support agents.
A customer support ticket could not be resolved automatically by the AI.
Generate a concise, exactly 3-line summary for the human agent who will take over this case.

Format strictly as 3 bullet lines:
Line 1: Customer Wants: <one clear sentence explaining what the customer is asking for or experiencing>
Line 2: AI Attempted: <one sentence summarizing what facts were checked or why the AI could not answer>
Line 3: Suggested Next Step: <one actionable recommendation for the human agent to resolve the issue>

Do not include any extra text or conversational filler.
"""


def generate_summary(ticket_text: str, attempted_answer: str = "") -> str:
    """
    Generate a 3-line summary for an escalated ticket:
    (1) what the customer wants,
    (2) what the AI tried,
    (3) the suggested next step.
    """
    user_content = f"CUSTOMER TICKET:\n{ticket_text}\n\nATTEMPTED AI ANSWER:\n{attempted_answer if attempted_answer else 'INSUFFICIENT_INFO'}"

    if LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
        try:
            return generate_gemini_content(
                prompt=user_content,
                system_prompt=SUMMARIZER_PROMPT,
                model=LLM_MODEL,
                api_key=GEMINI_API_KEY,
                max_tokens=1024
            ).strip()
        except Exception as e:
            logger.error("Error generating summary with Gemini: %s", e)
    elif LLM_PROVIDER == "anthropic" and ANTHROPIC_API_KEY and not ANTHROPIC_API_KEY.startswith("your_"):
        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=LLM_MODEL,
                max_tokens=300,
                system=SUMMARIZER_PROMPT,
                messages=[{"role": "user", "content": user_content}]
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error("Error generating summary with Anthropic: %s", e)

    # Deterministic fallback summary
    preview = ticket_text.strip().replace("\n", " ")[:90]
    line1 = f"1. Customer Wants: Customer needs assistance with: '{preview}...'"
    line2 = f"2. AI Attempted: Evaluated knowledge base but information was insufficient or confidence too low."
    line3 = "3. Suggested Next Step: Review customer order records and provide a tailored human response."
    return f"{line1}\n{line2}\n{line3}"

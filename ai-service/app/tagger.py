"""
Tagger Module for SupportSense.

Auto-tagging: Categorizing customer messages with predefined label keywords
and assessing emotional or operational urgency level.
"""

import json
import logging
import re
from typing import Dict, Any, List
import anthropic

from app.config import ANTHROPIC_API_KEY, GEMINI_API_KEY, LLM_PROVIDER, LLM_MODEL, ALLOWED_TAGS
from app.gemini_client import generate_gemini_content

logger = logging.getLogger(__name__)

TAGGER_PROMPT = f"""You are an automated ticket classification assistant for ShopEasy.
Analyze the customer's support ticket and classify it.

ALLOWED TAGS (Select 1 to 3 tags strictly from this exact list):
{json.dumps(ALLOWED_TAGS)}

URGENCY LEVELS:
- "low": General queries, return policy questions, how-to requests.
- "medium": Delayed orders, account access difficulties, general product defects.
- "high": Unauthorized charges, urgent cancellations before shipping, damaged expensive goods, aggressive disputes.

CRITICAL INSTRUCTIONS:
1. Output STRICT JSON ONLY. Do NOT use markdown code blocks.
2. Select between 1 and 3 tags. Every tag MUST be one of the ALLOWED TAGS.
3. If no specific tag clearly applies, use ["other"].
4. Output schema:
{{
  "tags": ["tag1", "tag2"],
  "urgency": "low" | "medium" | "high"
}}
"""


def _parse_tagger_json(raw_text: str) -> Dict[str, Any]:
    """Safely parse JSON response from LLM output, falling back to 'other' and 'low'."""
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

    try:
        data = json.loads(text)
        if isinstance(data, dict):
            tags = data.get("tags", [])
            urgency = data.get("urgency", "medium").lower()

            # Filter tags to only allowed tags
            valid_tags = [t for t in tags if t in ALLOWED_TAGS]
            if not valid_tags:
                valid_tags = ["other"]

            if urgency not in ["low", "medium", "high"]:
                urgency = "medium"

            return {
                "tags": valid_tags[:3],
                "urgency": urgency
            }
    except Exception as e:
        logger.warning("Failed to parse tagger output: %s (error: %s)", raw_text, e)

    return {
        "tags": ["other"],
        "urgency": "low"
    }


def _rule_based_tagger_fallback(ticket_text: str) -> Dict[str, Any]:
    """Rule-based tagger fallback when Anthropic API is offline or key is missing."""
    text = ticket_text.lower()
    matched_tags = []

    if any(k in text for k in ["refund", "money back", "reimburse", "return fee", "return"]):
        matched_tags.append("refund")
    if any(k in text for k in ["shipping", "ship", "delivery", "delay", "late", "where is my order", "hasn't arrived", "not arrived", "tracking", "track", "fedex", "ups"]):
        matched_tags.append("shipping")
    if any(k in text for k in ["payment", "card", "decline", "payment failed", "failed payment", "3d secure", "double charge", "duplicate charge", "charged twice", "pending hold"]):
        matched_tags.append("payment")
    if any(k in text for k in ["login", "locked", "account", "2fa", "two-factor", "authenticator", "password", "forgot password", "reset link"]):
        matched_tags.append("login")
    if any(k in text for k in ["cancel", "cancellation", "cancel order", "stop order"]):
        matched_tags.append("cancellation")
    if any(k in text for k in ["warranty", "care+", "protection plan", "broken", "defective", "damaged", "malfunction", "not working"]):
        matched_tags.append("warranty")

    if not matched_tags:
        matched_tags = ["other"]

    # Deduplicate while preserving order
    unique_tags = list(dict.fromkeys([t for t in matched_tags if t in ALLOWED_TAGS]))
    if not unique_tags:
        unique_tags = ["other"]

    # Urgency heuristic
    urgency = "low"
    if any(k in text for k in ["urgent", "immediately", "fraud", "stolen", "unauthorized", "charged twice", "double charge", "cancel my order"]):
        urgency = "high"
    elif any(k in text for k in ["delay", "failed", "broken", "locked", "defective", "late", "not working"]):
        urgency = "medium"

    return {
        "tags": unique_tags[:3],
        "urgency": urgency
    }


def classify_ticket(ticket_text: str) -> Dict[str, Any]:
    """
    Classify a customer ticket into 1 to 3 tags and assign an urgency rating.
    """
    if LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
        try:
            raw_text = generate_gemini_content(
                prompt=f"CUSTOMER TICKET:\n{ticket_text}",
                system_prompt=TAGGER_PROMPT,
                model=LLM_MODEL,
                api_key=GEMINI_API_KEY,
                max_tokens=300,
                response_json=True
            )
            return _parse_tagger_json(raw_text)
        except Exception as e:
            logger.error("Error communicating with Gemini for tagging: %s", e)
    elif LLM_PROVIDER == "anthropic" and ANTHROPIC_API_KEY and not ANTHROPIC_API_KEY.startswith("your_"):
        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=LLM_MODEL,
                max_tokens=200,
                system=TAGGER_PROMPT,
                messages=[{"role": "user", "content": f"CUSTOMER TICKET:\n{ticket_text}"}]
            )
            raw_text = response.content[0].text
            return _parse_tagger_json(raw_text)
        except Exception as e:
            logger.error("Error communicating with Anthropic for tagging: %s", e)

    return _rule_based_tagger_fallback(ticket_text)

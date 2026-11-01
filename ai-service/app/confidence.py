"""
Confidence Calculation Module for SupportSense.

Confidence score: A numerical value between 0.0 and 1.0 indicating how certain
the system is that its generated answer is correct and completely grounded in
company documents.
"""

from app.config import CONFIDENCE_THRESHOLD


def calculate_confidence(
    retrieval_similarity_score: float,
    llm_self_confidence: float,
    is_insufficient: bool,
    threshold: float = CONFIDENCE_THRESHOLD,
) -> tuple[float, bool]:
    """
    Calculate the final confidence score and determine if human escalation is needed.

    Formula:
      final_confidence = 0.5 * retrieval_similarity_score + 0.5 * llm_self_confidence

    Rule:
      If answer is INSUFFICIENT_INFO, final confidence is forced to 0.0.
      needs_human is True when final_confidence is below threshold.
    """
    if is_insufficient:
        return 0.0, True

    # Clamp scores between 0.0 and 1.0
    r_score = max(0.0, min(1.0, float(retrieval_similarity_score)))
    l_score = max(0.0, min(1.0, float(llm_self_confidence)))

    final_confidence = round(0.5 * r_score + 0.5 * l_score, 4)
    needs_human = final_confidence < threshold

    return final_confidence, needs_human

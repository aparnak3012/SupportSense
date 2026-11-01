"""
Runtime settings that can change while the service is running.

The weekly model update tunes the confidence threshold and learns from human
replies. The threshold is saved to a small JSON file so it survives restarts
and is picked up by the next /answer call without a restart.
"""

import json
import logging
from app.config import AI_SERVICE_DIR, CONFIDENCE_THRESHOLD

logger = logging.getLogger(__name__)

SETTINGS_PATH = AI_SERVICE_DIR / "data" / "runtime_settings.json"

MIN_THRESHOLD = 0.5
MAX_THRESHOLD = 0.8


def get_threshold() -> float:
    """Return the tuned confidence threshold, falling back to the .env value."""
    try:
        data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        value = float(data["confidence_threshold"])
        return max(MIN_THRESHOLD, min(MAX_THRESHOLD, value))
    except (OSError, ValueError, KeyError, TypeError):
        return CONFIDENCE_THRESHOLD


def set_threshold(value: float) -> float:
    """Clamp, persist and return the new confidence threshold."""
    clamped = round(max(MIN_THRESHOLD, min(MAX_THRESHOLD, float(value))), 2)
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps({"confidence_threshold": clamped}), encoding="utf-8")
    logger.info("Confidence threshold set to %.2f", clamped)
    return clamped

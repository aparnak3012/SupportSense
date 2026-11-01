"""
Google Gemini API Client for SupportSense.

Provides direct HTTP REST communication with Google Gemini API models (e.g. gemini-3.5-flash-lite, gemini-3.5-flash)
using standard Python libraries (urllib), with no external package requirements.
"""

import json
import logging
import urllib.request
import urllib.error
from typing import Optional

logger = logging.getLogger(__name__)


def generate_gemini_content(
    prompt: str,
    system_prompt: str = "",
    model: str = "gemini-3.5-flash-lite",
    api_key: str = "",
    max_tokens: int = 2048,
    response_json: bool = False,
) -> str:
    """
    Call Google Gemini REST generateContent endpoint.

    API Key: Passed in query string as ?key={api_key}.
    System instruction and prompt parts are formatted according to the Gemini v1beta spec.
    """
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured.")

    # Clean model identifier
    clean_model = model.replace("models/", "").strip()
    # Normalize deprecated or legacy model names to active Gemini models
    if clean_model in ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"]:
        clean_model = "gemini-3.5-flash-lite"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={api_key}"

    gen_config: dict = {
        "temperature": 0.0,
        "maxOutputTokens": max_tokens,
    }
    if response_json:
        gen_config["responseMimeType"] = "application/json"

    payload: dict = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": gen_config,
    }

    if system_prompt:
        payload["systemInstruction"] = {
            "parts": [{"text": system_prompt}]
        }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            candidates = res_data.get("candidates", [])
            if not candidates:
                logger.warning("Gemini returned no candidates: %s", res_data)
                return ""

            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                return parts[0].get("text", "")
            return ""
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        logger.error("Gemini API HTTP Error %s: %s", e.code, error_body)
        raise RuntimeError(f"Gemini API Error {e.code}: {error_body}")
    except Exception as e:
        logger.error("Gemini API connection error: %s", e)
        raise

import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory for the AI service
AI_SERVICE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = AI_SERVICE_DIR.parent

# Load .env file from project root first, then ai-service folder if present
if (PROJECT_ROOT / ".env").exists():
    load_dotenv(PROJECT_ROOT / ".env")
elif (AI_SERVICE_DIR / ".env").exists():
    load_dotenv(AI_SERVICE_DIR / ".env")

# LLM Configuration
# GEMINI_API_KEY: Secret key provided by Google AI Studio
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", "")).strip()

# ANTHROPIC_API_KEY: Secret key provided by Anthropic to authenticate API calls
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()

# Determine active LLM provider (gemini, anthropic, or fallback)
configured_provider = os.getenv("LLM_PROVIDER", "").strip().lower()
if configured_provider in ["gemini", "anthropic"]:
    LLM_PROVIDER = configured_provider
elif GEMINI_API_KEY and not GEMINI_API_KEY.startswith("your_"):
    LLM_PROVIDER = "gemini"
elif ANTHROPIC_API_KEY and not ANTHROPIC_API_KEY.startswith("your_"):
    LLM_PROVIDER = "anthropic"
else:
    LLM_PROVIDER = "fallback"

# LLM_MODEL: Model identifier based on provider
raw_model = os.getenv("LLM_MODEL", "").strip()
if raw_model:
    LLM_MODEL = raw_model
elif LLM_PROVIDER == "gemini":
    LLM_MODEL = "gemini-3.5-flash"
else:
    LLM_MODEL = "claude-3-haiku-20240307"

# CONFIDENCE_THRESHOLD: Cutoff score below which the ticket must be escalated to a human agent
try:
    CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.6"))
except ValueError:
    CONFIDENCE_THRESHOLD = 0.6

# Storage Paths
DOCS_DIR = Path(os.getenv("DOCS_DIR", str(AI_SERVICE_DIR / "data" / "docs"))).resolve()
CHROMA_PERSIST_DIR = Path(os.getenv("CHROMA_PERSIST_DIR", str(AI_SERVICE_DIR / "data" / "chroma_db"))).resolve()

# Embedding Model Name
# sentence-transformers model runs locally and converts text into vector numbers
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

# Allowed tags list for auto-tagging (fixed list of categories)
ALLOWED_TAGS = [
    "refund",
    "shipping",
    "payment",
    "login",
    "cancellation",
    "warranty",
    "other",
]

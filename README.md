# SupportSense: AI-Powered Customer Support & Analytics System

SupportSense is an intelligent, grounded customer support automation platform built for modern e-commerce. When a customer submits a support ticket, SupportSense searches the company's verified documentation using vector semantic search, formulates an accurate answer using Anthropic Claude, and computes a transparent hybrid confidence score. If the confidence falls below the strict threshold (0.60) or documentation is insufficient, the system safely escalates the ticket to a human agent with a concise 3-line briefing. SupportSense automatically categorizes every ticket, captures human resolution feedback to continuously improve, and runs an automated weekly analytics pipeline to uncover trending issues and documentation gaps.

---

## Technical Glossary (Simple Definitions)

To ensure clarity for every developer and stakeholder, every technical term used in this platform is defined below in simple English:

- **RAG (Retrieval-Augmented Generation):** An AI technique where the system first searches for factual document excerpts from a knowledge base, then instructs a language model to generate an answer using strictly those verified facts.
- **LLM (Large Language Model):** An artificial intelligence model (such as Anthropic Claude) trained on vast amounts of language to understand questions and generate natural text.
- **Embedding:** A mathematical list of numbers (a vector) representing the semantic meaning of a piece of text.
- **Vector Database (ChromaDB):** A specialized database designed to store text embeddings and quickly find the most semantically similar documents to a search query.
- **Cosine Similarity:** A mathematical score between 0.0 and 1.0 measuring how closely the meaning of two pieces of text align.
- **Hybrid Confidence Score:** A balanced certainty metric combining document retrieval relevance (50%) and language model self-confidence (50%).
- **Ticket Escalation:** The automatic routing of uncertain or out-of-scope customer inquiries to human support staff instead of sending an inaccurate AI guess.
- **Auto-Tagging:** The automatic classification of support tickets into standardized business categories (such as `refund`, `shipping`, or `warranty`).
- **Cron Job:** An automated background task configured to run on a recurring clock schedule (e.g., every Monday at 9:00 AM).
- **Feedback Pair:** A logged training record pairing an escalated ticket with the verified answer provided by a human agent.

---

## System Architecture

```text
+-----------------------------------------------------------------------------------+
|                                 CUSTOMER TICKET                                   |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                        NODE.JS EXPRESS BACKEND (:3000)                            |
|  - SQLite (better-sqlite3) Persistence (tickets, reports, feedback_pairs)         |
|  - REST API Routes (/api/tickets, /api/reports, /api/kb)                          |
|  - Modern Bright Dashboard (HTML5, Vanilla CSS, Chart.js)                         |
|  - Automated Weekly Cron Scheduler (node-cron: 0 9 * * 1)                         |
+-----------------------------------------+-----------------------------------------+
                                          | HTTP JSON
                                          v
+-----------------------------------------------------------------------------------+
|                         PYTHON FASTAPI SERVICE (:8000)                            |
|                                                                                   |
|  1. Embedding & Vector Search (ChromaDB + sentence-transformers/all-MiniLM-L6-v2) |
|     - Finds top 4 document chunks from ShopEasy Knowledge Base                   |
|     - Calculates Cosine Retrieval Similarity (0.0 to 1.0)                         |
|                                                                                   |
|  2. Grounded Generation (Anthropic Claude 3 Haiku / Fallback)                     |
|     - Strict instruction: Answer ONLY from retrieved facts or INSUFFICIENT_INFO   |
|     - Evaluates LLM Self-Confidence (0.0 to 1.0)                                  |
|                                                                                   |
|  3. Hybrid Confidence Calculation                                                 |
|     - Confidence = 0.5 * Retrieval Similarity + 0.5 * LLM Confidence              |
|     - If Answer == "INSUFFICIENT_INFO", Confidence forced to 0.0                  |
|                                                                                   |
|  4. Intelligent Escalation & Auto-Tagging                                          |
|     - If Confidence >= 0.60: Auto-resolves with verified answer                   |
|     - If Confidence < 0.60: Flags needs_human=true and generates 3-line briefing   |
|     - Auto-tags into: refund, shipping, payment, login, cancellation,             |
|       warranty, or other                                                          |
+-----------------------------------------------------------------------------------+
```

---

## Project Structure

```text
supportSense/
├── .env                         # Root environment configuration
├── .env.example                 # Example configuration template
├── README.md                    # Project documentation
│
├── ai-service/                  # Python 3.11+ FastAPI Service
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py            # Environment settings and constants
│   │   ├── chunker.py           # 500-char chunking with 50-char overlap
│   │   ├── retriever.py         # ChromaDB indexing & cosine similarity retrieval
│   │   ├── confidence.py        # Hybrid confidence formula (0.5 * sim + 0.5 * llm)
│   │   ├── answerer.py          # Grounded RAG answer generation via Claude
│   │   ├── summarizer.py        # 3-line escalation briefing generator
│   │   ├── tagger.py            # 7-category ticket classification
│   │   ├── insights.py          # Weekly recurring analytics & gap detection
│   │   └── main.py              # FastAPI endpoints & lifecycle hooks
│   ├── data/
│   │   ├── docs/                # 6 ShopEasy Markdown Help Documents
│   │   │   ├── returns_and_refunds.md
│   │   │   ├── shipping_and_delivery.md
│   │   │   ├── payment_issues.md
│   │   │   ├── account_and_login.md
│   │   │   ├── order_cancellation.md
│   │   │   └── warranty.md
│   │   └── chroma_db/           # Local persistent Chroma vector database
│   ├── eval/                    # Evaluation benchmark suite
│   │   ├── test_tickets.json    # 42 benchmark tickets (31 in-scope, 11 out-of-scope)
│   │   ├── run_eval.py          # Multi-threshold evaluation runner
│   │   └── results.md           # Benchmark accuracy & precision results
│   ├── tests/
│   │   └── test_ai_service.py   # Pytest suite for RAG, confidence, and tagging
│   └── requirements.txt         # Python package dependencies
│
└── backend/                     # Node.js 20+ TypeScript Express Backend
    ├── public/                  # Web Dashboard Frontend (No React)
    │   ├── index.html           # Main dashboard layout
    │   ├── 404.html             # Custom branded 404 error page
    │   ├── styles.css           # Modern bright light-theme styling (Vanilla CSS)
    │   └── app.js               # Client interaction, filtering, modals, & Chart.js
    ├── src/
    │   ├── config.ts            # Backend environment configuration
    │   ├── db/
    │   │   └── database.ts      # SQLite schema and query methods (better-sqlite3)
    │   ├── routes/
    │   │   ├── tickets.ts       # Ticket submission, list, filter, & resolution API
    │   │   ├── reports.ts       # Weekly reports retrieval & trigger API
    │   │   └── kb.ts            # Knowledge base documents listing & ingestion API
    │   ├── services/
    │   │   ├── aiClient.ts      # HTTP bridge to Python AI service with fallback
    │   │   └── reportJob.ts     # Automated weekly cron job and report generation
    │   ├── server.ts            # Express server entry point
    │   └── seedDemo.ts          # Demo data generator (30 tickets across 14 days)
    ├── package.json             # Node dependencies and scripts
    └── tsconfig.json            # TypeScript compiler configuration
```

---

## Prerequisites

Before starting, ensure you have the following installed on your machine:
- **Node.js:** v20.x or v22.x+ (verified on Node v24.x)
- **Python:** v3.11.x or v3.12.x
- **LLM API Key:** Google Gemini API Key (free tier available at [Google AI Studio](https://aistudio.google.com/app/apikey)) or Anthropic Claude API Key (optional alternative; robust grounded fallback is built-in if offline)

---

## Environment Setup

Create your `.env` file in the project root:

```cmd
Run from supportsense:
copy .env.example .env
```

Open `.env` in your text editor and configure your settings:

```ini
# --- AI Service (Python FastAPI) ---
# Google Gemini API Key (recommended)
GEMINI_API_KEY=your_gemini_api_key_here

# Anthropic Claude API Key (optional alternative)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Active Provider: gemini | anthropic (auto-detected if blank)
LLM_PROVIDER=gemini

# LLM Model (e.g. gemini-3.5-flash, gemini-3.5-flash-lite, claude-3-haiku-20240307)
LLM_MODEL=gemini-3.5-flash
CONFIDENCE_THRESHOLD=0.6

# --- Backend Service (Node.js Express) ---
PORT=3000
AI_SERVICE_URL=http://127.0.0.1:8000
DATABASE_PATH=./data/supportsense.db
CRON_SCHEDULE=0 9 * * 1
```

---

## Step-by-Step Installation & Running

Follow these exact steps using standard **Windows Command Prompt (cmd.exe)**:

### 1. Set Up and Run the Python AI Service

```cmd
Run from supportsense\ai-service:
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

> **Note:** On first startup, the AI service automatically ingests and indexes the 6 markdown documents from `data/docs/` into ChromaDB (36 chunks). You can verify it is running by opening `http://127.0.0.1:8000/health`.

### 2. Set Up and Run the Node.js Backend

Open a **second** Command Prompt window:

```cmd
Run from supportsense\backend:
npm install
npm run build
npm run seed
npm start
```

Open your browser to:
**`http://localhost:3000`**

---

## How Confidence Is Calculated

SupportSense employs a **Hybrid Confidence Engine** designed to prevent artificial hallucinations while maximizing automated resolution speed:

$$\text{Final Confidence} = 0.5 \times \text{Retrieval Similarity} + 0.5 \times \text{LLM Self-Confidence}$$

1. **Retrieval Similarity ($S_{\text{retrieval}}$):**
   - Text chunks and the user ticket are converted into 384-dimensional dense vectors using `all-MiniLM-L6-v2`.
   - ChromaDB measures cosine distance $d \in [0, 2]$.
   - Cosine similarity is computed as $S = \max(0.0, 1.0 - d)$.
   - The top 4 chunks are examined; the highest similarity score forms the retrieval component.

2. **LLM Self-Confidence ($S_{\text{llm}}$):**
   - Claude evaluates how directly the retrieved excerpts answer every requirement of the customer ticket on a scale of $0.0$ to $1.0$.

3. **Strict Fallback Guarantee:**
   - If the documentation does not contain sufficient facts, the model is strictly constrained to output `INSUFFICIENT_INFO`.
   - Whenever an answer is `INSUFFICIENT_INFO`, **the final confidence is immediately forced to $0.0$**, triggering automatic human escalation.

4. **Escalation Threshold:**
   - If $\text{Final Confidence} \ge 0.60$: The ticket is auto-resolved with the verified answer.
   - If $\text{Final Confidence} < 0.60$: The ticket status becomes `escalated`. The AI service generates a 3-line briefing for human agents detailing:
     1. What the customer wants
     2. What the AI attempted
     3. The suggested next resolution step

---

## Weekly Analytics & Documentation Gaps

SupportSense continuously monitors support trends to help customer support leads optimize documentation:

1. **Automated Cron Schedule:**
   - Scheduled via `node-cron` using `0 9 * * 1` (every Monday at 9:00 AM).
   - An on-demand trigger button (`Run Weekly Report Now`) is also available on the dashboard.

2. **What the Report Calculates:**
   - **Ticket Volume:** Total tickets submitted and resolved during the previous 7-day period.
   - **Escalation Rate:** Percentage of tickets that required human intervention.
   - **Top Category Shifts:** Week-over-week distribution changes across the 7 tags visualized using Chart.js.
   - **Documentation Gaps:** Escalated tickets with low similarity scores are analyzed by `POST /insights` to recommend exact topics or missing FAQ articles to author.

---

## Running Automated Tests

To run the automated test suite for the Python AI Service:

```cmd
Run from supportsense\ai-service:
.venv\Scripts\python.exe -m pytest tests/ -v
```

To run the automated tests for the Node.js backend:

```cmd
Run from supportsense\backend:
npm test
```

---

## Running the Evaluation Benchmark

SupportSense includes a dedicated benchmark suite with 42 real-world support tickets (31 answerable from the help documentation, 11 completely out-of-scope):

```cmd
Run from supportsense\ai-service:
.venv\Scripts\python.exe eval\run_eval.py
```

The script evaluates performance across thresholds `0.4`, `0.6`, and `0.8`, computing:
- **Answer Accuracy (%):** Presence of expected policy keywords on answerable tickets.
- **Wrong-Answer Rate (%):** Rate of out-of-scope tickets erroneously answered.
- **Escalation Precision & Recall (%):** Reliability of human routing.
- **Output Report:** Automatically saved to `ai-service/eval/results.md`.

---

## API Reference

### Python AI Service (`http://127.0.0.1:8000`)

| Method | Endpoint | Request Body | Description |
|---|---|---|---|
| `GET` | `/health` | _None_ | Returns service status, model info, and chunk count |
| `POST` | `/ingest` | _None_ | Chunks and re-indexes all markdown files in `data/docs/` |
| `POST` | `/answer` | `{"ticket_text": "..."}` | Executes RAG pipeline and returns answer, confidence, sources, and needs_human |
| `POST` | `/summarize` | `{"ticket_text": "...", "attempted_answer": "..."}` | Returns 3-line escalation summary |
| `POST` | `/tag` | `{"ticket_text": "..."}` | Classifies ticket into 1 of 7 standard categories |
| `POST` | `/insights` | `{"escalated_tickets": [...]}` | Identifies missing knowledge topics from escalated queries |

### Node.js Backend (`http://localhost:3000`)

| Method | Endpoint | Request Body | Description |
|---|---|---|---|
| `GET` | `/api/tickets` | Query params: `status`, `tag`, `page`, `limit` | Paginated list of tickets |
| `POST` | `/api/tickets` | `{"customer_name": "...", "customer_email": "...", "text": "..."}` | Submit new support ticket |
| `GET` | `/api/tickets/:id` | _None_ | Retrieve ticket details and escalation briefing |
| `POST` | `/api/tickets/:id/resolve`| `{"human_response": "..."}` | Resolve escalated ticket and save feedback pair |
| `GET` | `/api/reports/latest`| _None_ | Retrieve the most recent weekly analytics report |
| `POST` | `/api/reports/generate`| _None_ | Manually trigger generation of a weekly analytics report |
| `GET` | `/api/kb/docs` | _None_ | List available knowledge base documentation files |
| `POST` | `/api/kb/reingest` | _None_ | Trigger vector re-indexing on the AI service |

# SupportSense - Terminal Commands Quick Reference

This file contains copy-paste Windows Command Prompt (`cmd.exe`) commands to start, seed, test, and benchmark the SupportSense platform.

---

## 1. Quick Start (One-Click)

Simply double-click:
```cmd
start_project.bat
```
This automatically launches both the Python AI service and the Node.js backend in separate windows and opens `http://localhost:3000` in your browser.

---

## 2. Manual Startup (Two Command Windows)

If you prefer running commands manually, open two standard Windows Command Prompt windows:

### Terminal 1: Python AI Service (Port 8000)

```cmd
Run from supportsense\ai-service:
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
> **Health Check:** Open `http://127.0.0.1:8000/health` in your browser.

---

### Terminal 2: Node.js Backend & Dashboard (Port 3000)

```cmd
Run from supportsense\backend:
node dist/server.js
```
> **Dashboard:** Open `http://localhost:3000` in your browser.

---

## 3. Fresh Installation & Setup Commands

If setting up the project on a new teammate's laptop for the first time:

### Step 1: Environment Variables
```cmd
Run from supportsense:
copy .env.example .env
```
*(Open `.env` and paste your free Google Gemini API key or Anthropic API key on line 7).*

### Step 2: Python Virtual Environment & Dependencies
```cmd
Run from supportsense\ai-service:
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Step 3: Node.js Dependencies, Build, & Seed Demo Data
```cmd
Run from supportsense\backend:
npm install
npm run build
npm run seed
```

---

## 4. Reset & Seed Demo Data

To re-populate the SQLite database with 30 realistic demo tickets spanning the last 14 days:

```cmd
Run from supportsense\backend:
npm run seed
```

---

## 5. Running Automated Unit Tests

### Python AI Service Tests (9 Pytest Tests):
```cmd
Run from supportsense\ai-service:
.venv\Scripts\python.exe -m pytest tests/ -v
```

### Backend & SQLite Tests:
```cmd
Run from supportsense\backend:
npm test
```

---

## 6. Running the Evaluation Benchmark Suite

To test the system against 42 real-world support tickets (31 answerable, 11 out-of-scope) and measure accuracy, escalation recall, and zero-hallucination rate:

```cmd
Run from supportsense\ai-service:
.venv\Scripts\python.exe eval\run_eval.py
```
> Detailed benchmark results will be printed to the terminal and saved to [ai-service/eval/results.md](file:///c:/Users/arshj/OneDrive/Desktop/supportSense/ai-service/eval/results.md).

---

## 7. Service URLs Summary

| Component | URL | Purpose |
|---|---|---|
| **SupportSense Dashboard** | `http://localhost:3000` | Main customer support dashboard & analytics |
| **Weekly Report API** | `http://localhost:3000/api/reports/latest` | Latest weekly analytics JSON |
| **AI Service Health** | `http://127.0.0.1:8000/health` | Status, active LLM provider, and chunk count |
| **Interactive API Docs** | `http://127.0.0.1:8000/docs` | Swagger interactive OpenAPI documentation |

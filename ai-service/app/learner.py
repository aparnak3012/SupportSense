"""
Learning Module for SupportSense.

Turns human agent replies into a knowledge base document so the RAG pipeline can
answer similar tickets automatically next time.
"""

from typing import Dict, Any, List
from app.config import DOCS_DIR
from app.ingest import ingest_documents

LEARNED_FILE = "learned_from_agents.md"


def learn_from_replies(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Merge new agent replies into learned_from_agents.md (deduplicated by question)
    and re-ingest the knowledge base.
    """
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    path = DOCS_DIR / LEARNED_FILE

    existing: Dict[str, str] = {}
    if path.exists():
        for block in path.read_text(encoding="utf-8").split("\n## Q: ")[1:]:
            question, _, reply = block.partition("\nA: ")
            existing[question.strip()] = reply.strip()

    added = 0
    for item in items:
        question = " ".join(str(item.get("ticket_text", "")).split())
        reply = str(item.get("human_reply", "")).strip()
        if not question or not reply or question in existing:
            continue
        existing[question] = reply
        added += 1

    if added:
        lines = ["# Answers Learned From Support Agents", ""]
        for question, reply in existing.items():
            lines += [f"## Q: {question}", f"A: {reply}", ""]
        path.write_text("\n".join(lines), encoding="utf-8")

    result = ingest_documents()
    return {"added": added, "total_learned": len(existing), "chunks_stored": result["chunks_stored"]}

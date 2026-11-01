"""
Integration tests for Phase 2 endpoints: /tag, /summarize, /insights.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_tag_endpoint():
    """Verify POST /tag returns a valid list of tags from ALLOWED_TAGS."""
    resp = client.post("/tag", json={"ticket_text": "I want a refund for my damaged shoes."})
    assert resp.status_code == 200
    data = resp.json()
    assert "tags" in data
    assert isinstance(data["tags"], list)
    assert len(data["tags"]) > 0
    assert "urgency" in data
    assert data["urgency"] in ["low", "medium", "high"]


def test_summarize_endpoint():
    """Verify POST /summarize returns a 3-line briefing."""
    resp = client.post("/summarize", json={
        "ticket_text": "My package hasn't arrived in 10 days.",
        "attempted_answer": "INSUFFICIENT_INFO"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "summary" in data
    summary = data["summary"]
    lines = [line.strip() for line in summary.split("\n") if line.strip()]
    assert len(lines) >= 3


def test_insights_endpoint():
    """Verify POST /insights generates an executive summary from weekly metrics."""
    payload = {
        "total_tickets": 30,
        "auto_resolved_pct": 60.0,
        "escalated_pct": 40.0,
        "top_tags": [{"tag": "shipping", "count": 12}, {"tag": "refund", "count": 8}],
        "knowledge_gaps": [{"topic": "Cryptocurrency Payments", "count": 4}],
        "avg_confidence": 0.65
    }
    resp = client.post("/insights", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "insight" in data
    assert isinstance(data["insight"], str)
    assert len(data["insight"]) > 20

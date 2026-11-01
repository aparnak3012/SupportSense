"""
Unit and Integration Tests for Phase 1 - SupportSense AI Service.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.ingest import chunk_text, ingest_documents
from app.confidence import calculate_confidence

client = TestClient(app)


def test_health_endpoint():
    """Verify GET /health returns status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "model" in data
    assert "confidence_threshold" in data


def test_chunk_text_logic():
    """Test chunking with 500 characters and 50 characters overlap."""
    text = "A" * 1200
    chunks = chunk_text(text, chunk_size=500, overlap=50)
    assert len(chunks) == 3
    assert len(chunks[0]) == 500
    # Next chunk starts at 450
    assert len(chunks[1]) == 500
    # Last chunk has remaining characters
    assert len(chunks[2]) <= 500


def test_confidence_calculation():
    """Test confidence score formula and thresholding."""
    # When answer is insufficient, confidence must be 0 and needs_human True
    conf, needs_human = calculate_confidence(0.8, 0.9, is_insufficient=True, threshold=0.6)
    assert conf == 0.0
    assert needs_human is True

    # 50/50 formula: 0.5 * 0.7 + 0.5 * 0.9 = 0.80 >= 0.6 -> needs_human False
    conf, needs_human = calculate_confidence(0.7, 0.9, is_insufficient=False, threshold=0.6)
    assert conf == 0.8
    assert needs_human is False

    # Low score: 0.5 * 0.3 + 0.5 * 0.4 = 0.35 < 0.6 -> needs_human True
    conf, needs_human = calculate_confidence(0.3, 0.4, is_insufficient=False, threshold=0.6)
    assert conf == 0.35
    assert needs_human is True


def test_ingest_endpoint():
    """Verify POST /ingest processes all documents."""
    response = client.post("/ingest")
    assert response.status_code == 200
    data = response.json()
    assert data["chunks_stored"] > 0
    assert len(data["files_processed"]) == 6
    assert "returns_and_refunds.md" in data["files_processed"]


def test_answer_endpoint_insufficient():
    """Verify POST /answer on out-of-scope query marks needs_human true."""
    response = client.post("/answer", json={"ticket_text": "How do I invest in bitcoin cryptocurrency on your platform?"})
    assert response.status_code == 200
    data = response.json()
    assert data["needs_human"] is True
    assert data["confidence"] < 0.6


def test_answer_endpoint_grounded():
    """Verify POST /answer returns sources for a valid shop inquiry."""
    response = client.post("/answer", json={"ticket_text": "What is the return window for electronics and items?"})
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "confidence" in data
    assert len(data["sources"]) > 0
    assert "returns_and_refunds.md" in data["sources"]

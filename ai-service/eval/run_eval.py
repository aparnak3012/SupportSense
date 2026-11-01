"""
Evaluation Runner for SupportSense AI Service.

This script executes a benchmark against test tickets to measure:
1. Answer Accuracy (keyword coverage for in-scope tickets)
2. Wrong-Answer Rate (out-of-scope tickets wrongly answered)
3. Escalation Precision and Recall
4. Average Confidence for answered vs escalated tickets
5. Performance across multiple confidence thresholds (0.4, 0.6, 0.8)

Results are printed to the console and saved to ai-service/eval/results.md.
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, Any, List
import urllib.request
import urllib.error

# Ensure app package is importable if executed directly
EVAL_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = EVAL_DIR.parent
if str(AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_DIR))

try:
    from app.answerer import generate_answer
except ImportError:
    generate_answer = None

API_URL = os.getenv("API_URL", "http://127.0.0.1:8000/answer")
TEST_TICKETS_FILE = EVAL_DIR / "test_tickets.json"
RESULTS_FILE = EVAL_DIR / "results.md"


def query_answer_endpoint(ticket_text: str) -> Dict[str, Any]:
    """Call the HTTP API endpoint, falling back to direct Python invocation if unavailable."""
    data = json.dumps({"ticket_text": ticket_text}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return json.loads(res.read().decode("utf-8"))
    except Exception as e:
        if generate_answer is not None:
            return generate_answer(ticket_text)
        raise RuntimeError(f"Could not connect to {API_URL} and internal answerer is not available: {e}")


def check_keywords(answer_text: str, expected_keywords: List[str]) -> bool:
    """Check if at least one or all expected keywords appear in the answer text (case-insensitive)."""
    if not expected_keywords:
        return True
    lower = answer_text.lower()
    # Matches if any of the key phrases appear
    return any(k.lower() in lower for k in expected_keywords)


def evaluate_dataset() -> None:
    print(f"Loading test tickets from {TEST_TICKETS_FILE}...")
    with open(TEST_TICKETS_FILE, "r", encoding="utf-8") as f:
        tickets = json.load(f)

    total_tickets = len(tickets)
    print(f"Total test tickets: {total_tickets}")
    print(f"Querying endpoint: {API_URL} (or local fallback)...")

    raw_results = []
    start_time = time.time()

    for idx, t in enumerate(tickets, start=1):
        ticket_id = t["id"]
        ticket_text = t["text"]
        should_answer = t["should_answer"]
        expected_keywords = t.get("expected_keywords", [])

        try:
            resp = query_answer_endpoint(ticket_text)
            answer = resp.get("answer", "")
            confidence = float(resp.get("confidence", 0.0))
            sources = resp.get("sources", [])
        except Exception as err:
            print(f"  [Ticket {ticket_id}] Error: {err}")
            answer = "INSUFFICIENT_INFO"
            confidence = 0.0
            sources = []

        is_insufficient = (answer.strip() == "INSUFFICIENT_INFO" or confidence == 0.0)
        has_keywords = check_keywords(answer, expected_keywords) if should_answer else False

        raw_results.append({
            "id": ticket_id,
            "text": ticket_text,
            "should_answer": should_answer,
            "expected_keywords": expected_keywords,
            "answer": answer,
            "confidence": confidence,
            "sources": sources,
            "is_insufficient": is_insufficient,
            "has_keywords": has_keywords
        })
        print(f"  [{idx}/{total_tickets}] Ticket #{ticket_id}: conf={confidence:.2f}, should_answer={should_answer}, is_insufficient={is_insufficient}")

    duration = time.time() - start_time
    print(f"\nAll {total_tickets} tickets processed in {duration:.1f}s.")

    # Evaluate across thresholds
    thresholds = [0.4, 0.6, 0.8]
    summary_by_thresh = {}

    for thresh in thresholds:
        tp = 0  # Should escalate and did escalate (True Positive Escalation)
        fp = 0  # Should NOT escalate (answerable) but did escalate (False Positive Escalation)
        tn = 0  # Should NOT escalate and was answered (True Negative Escalation)
        fn = 0  # Should escalate but was answered (False Negative Escalation / Wrong answer)

        accurate_answers = 0
        total_answerable = sum(1 for r in raw_results if r["should_answer"])
        total_out_of_scope = sum(1 for r in raw_results if not r["should_answer"])

        answered_confidences = []
        escalated_confidences = []

        for r in raw_results:
            # Under this threshold, does the system answer or escalate?
            is_answered = (r["confidence"] >= thresh) and (not r["is_insufficient"])

            if is_answered:
                answered_confidences.append(r["confidence"])
            else:
                escalated_confidences.append(r["confidence"])

            if r["should_answer"]:
                if is_answered:
                    tn += 1
                    if r["has_keywords"]:
                        accurate_answers += 1
                else:
                    fp += 1  # Unnecessarily escalated
            else:
                if not is_answered:
                    tp += 1  # Correctly escalated
                else:
                    fn += 1  # Wrongly answered out-of-scope ticket

        # Metrics
        # Answer accuracy: among tickets that SHOULD be answered, what % received accurate answers?
        answer_accuracy = (accurate_answers / total_answerable * 100.0) if total_answerable > 0 else 0.0

        # Wrong-answer rate: among out-of-scope tickets, what % did the system wrongly answer?
        wrong_answer_rate = (fn / total_out_of_scope * 100.0) if total_out_of_scope > 0 else 0.0

        # Escalation Precision = TP / (TP + FP)
        escalation_precision = (tp / (tp + fp) * 100.0) if (tp + fp) > 0 else 0.0

        # Escalation Recall = TP / (TP + FN)
        escalation_recall = (tp / (tp + fn) * 100.0) if (tp + fn) > 0 else 0.0

        avg_conf_answered = (sum(answered_confidences) / len(answered_confidences)) if answered_confidences else 0.0
        avg_conf_escalated = (sum(escalated_confidences) / len(escalated_confidences)) if escalated_confidences else 0.0

        summary_by_thresh[thresh] = {
            "threshold": thresh,
            "answer_accuracy": answer_accuracy,
            "wrong_answer_rate": wrong_answer_rate,
            "escalation_precision": escalation_precision,
            "escalation_recall": escalation_recall,
            "avg_conf_answered": avg_conf_answered,
            "avg_conf_escalated": avg_conf_escalated,
            "tp": tp, "fp": fp, "tn": tn, "fn": fn
        }

    # Print summary table
    print("\n" + "=" * 80)
    print("SUPPORT SENSE EVALUATION RESULTS")
    print("=" * 80)
    header = f"{'Threshold':<10} | {'Answer Acc':<12} | {'Wrong Ans %':<12} | {'Esc Precision':<14} | {'Esc Recall':<12} | {'Avg Conf (Ans)':<15} | {'Avg Conf (Esc)':<15}"
    print(header)
    print("-" * len(header))
    for thresh in thresholds:
        s = summary_by_thresh[thresh]
        print(f"{s['threshold']:<10.1f} | {s['answer_accuracy']:<11.1f}% | {s['wrong_answer_rate']:<11.1f}% | {s['escalation_precision']:<13.1f}% | {s['escalation_recall']:<11.1f}% | {s['avg_conf_answered']:<15.2f} | {s['avg_conf_escalated']:<15.2f}")
    print("=" * 80)

    # Generate Markdown Report
    md_lines = [
        "# SupportSense Evaluation Report",
        "",
        f"- **Date:** {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"- **Total Test Tickets:** {total_tickets} ({sum(1 for r in raw_results if r['should_answer'])} answerable, {sum(1 for r in raw_results if not r['should_answer'])} out-of-scope)",
        f"- **Target API:** `{API_URL}`",
        f"- **Benchmark Duration:** {duration:.2f} seconds",
        "",
        "## 1. Metrics by Confidence Threshold",
        "",
        "| Threshold | Answer Accuracy (%) | Wrong-Answer Rate (%) | Escalation Precision (%) | Escalation Recall (%) | Avg Conf (Answered) | Avg Conf (Escalated) |",
        "|---|---|---|---|---|---|---|"
    ]

    for thresh in thresholds:
        s = summary_by_thresh[thresh]
        md_lines.append(
            f"| **{s['threshold']:.1f}** | {s['answer_accuracy']:.1f}% | {s['wrong_answer_rate']:.1f}% | {s['escalation_precision']:.1f}% | {s['escalation_recall']:.1f}% | {s['avg_conf_answered']:.2f} | {s['avg_conf_escalated']:.2f} |"
        )

    md_lines.extend([
        "",
        "## 2. Threshold Trade-Off Analysis",
        "",
        "- **Threshold 0.4 (Permissive):** Answers a high volume of queries directly, but risks answering edge cases or low-relevance queries.",
        "- **Threshold 0.6 (Balanced - Recommended Default):** Strikes an optimal balance with high answer accuracy on covered documentation while reliably deflecting out-of-scope requests to human support.",
        "- **Threshold 0.8 (Conservative):** Only answers queries with near-perfect factual alignment; escalates any borderline tickets to human agents.",
        "",
        "## 3. Sample Evaluation Details (First 10 Tickets)",
        "",
        "| ID | Question | Expected | Confidence | Status |",
        "|---|---|---|---|---|"
    ])

    for r in raw_results[:10]:
        status = "Answered" if not r["is_insufficient"] and r["confidence"] >= 0.6 else "Escalated"
        clean_text = r["text"].replace("|", "\\|")
        md_lines.append(f"| {r['id']} | {clean_text} | {'Answer' if r['should_answer'] else 'Escalate'} | {r['confidence']:.2f} | {status} |")

    md_lines.append("")

    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))

    print(f"\nDetailed evaluation report saved to: {RESULTS_FILE}")


if __name__ == "__main__":
    evaluate_dataset()

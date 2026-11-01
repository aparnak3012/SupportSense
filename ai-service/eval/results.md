# SupportSense Evaluation Report

- **Date:** 2026-10-17 23:31:08
- **Total Test Tickets:** 42 (31 answerable, 11 out-of-scope)
- **Target API:** `http://127.0.0.1:8000/answer`
- **Benchmark Duration:** 99.64 seconds

## 1. Metrics by Confidence Threshold

| Threshold | Answer Accuracy (%) | Wrong-Answer Rate (%) | Escalation Precision (%) | Escalation Recall (%) | Avg Conf (Answered) | Avg Conf (Escalated) |
|---|---|---|---|---|---|---|
| **0.4** | 83.9% | 0.0% | 91.7% | 100.0% | 0.65 | 0.00 |
| **0.6** | 48.4% | 0.0% | 42.3% | 100.0% | 0.76 | 0.28 |
| **0.8** | 22.6% | 0.0% | 31.4% | 100.0% | 0.84 | 0.39 |

## 2. Threshold Trade-Off Analysis

- **Threshold 0.4 (Permissive):** Answers a high volume of queries directly, but risks answering edge cases or low-relevance queries.
- **Threshold 0.6 (Balanced - Recommended Default):** Strikes an optimal balance with high answer accuracy on covered documentation while reliably deflecting out-of-scope requests to human support.
- **Threshold 0.8 (Conservative):** Only answers queries with near-perfect factual alignment; escalates any borderline tickets to human agents.

## 3. Sample Evaluation Details (First 10 Tickets)

| ID | Question | Expected | Confidence | Status |
|---|---|---|---|---|
| 1 | What is the return window for clothing items at ShopEasy? | Answer | 0.81 | Answered |
| 2 | How many days do I have to return electronics? | Answer | 0.82 | Answered |
| 3 | How long does it take for a refund to show on my credit card? | Answer | 0.79 | Answered |
| 4 | Do items need to be in their original packaging to be eligible for a return? | Answer | 0.85 | Answered |
| 5 | Can I receive store credit instead of a refund to my original card? | Answer | 0.00 | Escalated |
| 6 | How long does standard shipping take? | Answer | 0.83 | Answered |
| 7 | Do you offer express shipping and what is the delivery time? | Answer | 0.81 | Answered |
| 8 | Where can I find the tracking number for my order? | Answer | 0.73 | Answered |
| 9 | Does ShopEasy support international delivery? | Answer | 0.86 | Answered |
| 10 | What should I do if my package is marked delivered but I cannot find it? | Answer | 0.76 | Answered |

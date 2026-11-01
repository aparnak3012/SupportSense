import { db, FeedbackPairRecord } from '../db/database';
import { aiClient } from './aiClient';

const MIN_TICKETS = 10;
const STEP = 0.02;
const TARGET_ESCALATION_MIN_PCT = 15;
const TARGET_ESCALATION_MAX_PCT = 40;

export interface ModelUpdateResult {
  threshold_before: number | null;
  threshold_after: number | null;
  threshold_reason: string;
  learned_added: number;
  learned_total: number;
  chunks_stored: number | null;
}

/**
 * Decide the next confidence threshold from the weekly escalation rate.
 * Too many escalations -> lower it a little; too few -> raise it a little.
 */
export function proposeThreshold(
  current: number,
  totalTickets: number,
  escalatedPct: number
): { value: number; reason: string } {
  if (totalTickets < MIN_TICKETS) {
    return { value: current, reason: `Only ${totalTickets} tickets (need ${MIN_TICKETS}); threshold unchanged.` };
  }
  if (escalatedPct > TARGET_ESCALATION_MAX_PCT) {
    return { value: current - STEP, reason: `Escalation ${escalatedPct}% is above ${TARGET_ESCALATION_MAX_PCT}%; lowered threshold.` };
  }
  if (escalatedPct < TARGET_ESCALATION_MIN_PCT) {
    return { value: current + STEP, reason: `Escalation ${escalatedPct}% is below ${TARGET_ESCALATION_MIN_PCT}%; raised threshold for safety.` };
  }
  return { value: current, reason: `Escalation ${escalatedPct}% is within target; threshold unchanged.` };
}

/**
 * Runs after each weekly report: tunes the confidence threshold and teaches the
 * knowledge base the replies human agents wrote during the report window.
 */
export async function runModelUpdate(report: {
  total_tickets: number;
  escalated_pct: number;
}, weekStart: string, weekEnd: string): Promise<ModelUpdateResult> {
  const result: ModelUpdateResult = {
    threshold_before: null,
    threshold_after: null,
    threshold_reason: '',
    learned_added: 0,
    learned_total: 0,
    chunks_stored: null,
  };

  const health = await aiClient.getHealth();
  if (typeof health.confidence_threshold === 'number') {
    result.threshold_before = health.confidence_threshold;
    const proposal = proposeThreshold(health.confidence_threshold, report.total_tickets, report.escalated_pct);
    result.threshold_reason = proposal.reason;
    result.threshold_after = await aiClient.setThreshold(proposal.value);
  }

  const pairs = db
    .prepare('SELECT * FROM feedback_pairs WHERE created_at >= ? AND created_at <= ? ORDER BY id ASC')
    .all(weekStart, weekEnd) as FeedbackPairRecord[];
  if (pairs.length > 0) {
    const learned = await aiClient.learn(
      pairs.map((p) => ({ ticket_text: p.ticket_text, human_reply: p.human_reply }))
    );
    result.learned_added = learned.added;
    result.learned_total = learned.total_learned;
    result.chunks_stored = learned.chunks_stored;
  }

  return result;
}

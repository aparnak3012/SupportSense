/**
 * Backend Verification and Unit Test Script.
 * Runs tests against SQLite database methods, schema, and ticket lifecycle.
 */

import assert from 'assert';
import { db, dbOperations } from './db/database.js';

async function runTests() {
  console.log('Starting Backend Unit Tests...');

  // Test 1: Tables exist
  console.log('  [Test 1] Verifying database schema...');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  const tableNames = tables.map(t => t.name);
  assert(tableNames.includes('tickets'), "Table 'tickets' should exist");
  assert(tableNames.includes('reports'), "Table 'reports' should exist");
  assert(tableNames.includes('feedback_pairs'), "Table 'feedback_pairs' should exist");
  console.log('  ✓ Database schema verified (tickets, reports, feedback_pairs exist).');

  // Test 2: Ticket creation and AI update
  console.log('  [Test 2] Creating initial ticket...');
  const ticketId = dbOperations.createInitialTicket('tester@example.com', 'What is the return window?');
  assert(ticketId > 0, 'Ticket ID should be a positive number');
  console.log(`  ✓ Created ticket #${ticketId}`);

  console.log('  [Test 3] Updating ticket with AI auto-resolution...');
  const updated = dbOperations.updateTicketWithAiResult({
    id: ticketId,
    status: 'auto_resolved',
    ai_answer: 'You have 30 days to return eligible products.',
    confidence: 0.85,
    sources: ['returns_and_refunds.md'],
    summary: null,
    tags: ['refund'],
    urgency: 'low',
  });
  assert(updated !== null, 'Updated ticket should not be null');
  assert.strictEqual(updated.status, 'auto_resolved');
  assert.strictEqual(updated.confidence, 0.85);
  assert.deepStrictEqual(updated.sources, ['returns_and_refunds.md']);
  assert.deepStrictEqual(updated.tags, ['refund']);
  console.log('  ✓ AI auto-resolution update verified.');

  // Test 4: Escalation and Human Resolution with Feedback Pair
  console.log('  [Test 4] Testing escalation and human resolution...');
  const escId = dbOperations.createInitialTicket('esc@example.com', 'Can you deliver pizza to my home?');
  dbOperations.updateTicketWithAiResult({
    id: escId,
    status: 'escalated',
    ai_answer: 'INSUFFICIENT_INFO',
    confidence: 0.0,
    sources: [],
    summary: '1. Customer Wants: Pizza delivery\n2. AI Attempted: Not covered\n3. Next Step: Inform customer',
    tags: ['other'],
    urgency: 'low',
  });

  const humanReply = 'ShopEasy is an e-commerce retailer and does not provide hot food delivery.';
  const resolved = dbOperations.resolveTicketWithHumanReply(escId, humanReply);
  assert(resolved !== null, 'Resolved ticket should not be null');
  assert.strictEqual(resolved.status, 'human_resolved');
  assert.strictEqual(resolved.human_reply, humanReply);

  // Verify feedback pair was created
  const fbStmt = db.prepare('SELECT * FROM feedback_pairs WHERE ticket_id = ?');
  const fbRow: any = fbStmt.get(escId);
  assert(fbRow !== undefined, 'A feedback pair record must be created');
  assert.strictEqual(fbRow.human_reply, humanReply);
  console.log('  ✓ Human resolution and feedback_pair generation verified.');

  // Test 5: Reports saving and retrieval
  console.log('  [Test 5] Testing weekly reports persistence...');
  const reportPayload = {
    total_tickets: 15,
    auto_resolved: 10,
    escalated: 5,
    top_tags: [{ tag: 'refund', count: 7 }],
    knowledge_gaps: [{ topic: 'Delivery', count: 2 }],
  };
  const reportId = dbOperations.saveReport('2026-10-01', '2026-10-07', reportPayload);
  assert(reportId > 0, 'Report ID should be a positive number');

  const latest = dbOperations.getLatestReport();
  assert(latest !== null, 'Latest report should not be null');
  assert.strictEqual(latest.total_tickets, 15);
  console.log('  ✓ Weekly report persistence verified.');

  console.log('\n==========================================');
  console.log('ALL BACKEND UNIT TESTS PASSED SUCCESSFULLY');
  console.log('==========================================');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

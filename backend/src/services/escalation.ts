import { dbOperations, TicketRecord } from '../db/database';
import { aiClient } from './aiClient';

export const escalationService = {
  /**
   * Process a newly submitted support ticket through tagging, RAG answering, and escalation
   */
  async processTicket(customerEmail: string, ticketText: string): Promise<TicketRecord> {
    // Step 1: Save initial ticket with status "new"
    const ticketId = dbOperations.createInitialTicket(customerEmail, ticketText);

    try {
      // Step 2: Classify ticket with auto-tagging
      const tagResult = await aiClient.classifyTicket(ticketText);

      // Step 3: Run RAG answering
      const answerResult = await aiClient.getAnswer(ticketText);

      // Step 4: Branch based on confidence threshold and needs_human flag
      if (!answerResult.needs_human && answerResult.answer && answerResult.answer !== 'INSUFFICIENT_INFO') {
        // High confidence: Auto-resolve ticket
        const updated = dbOperations.updateTicketWithAiResult({
          id: ticketId,
          status: 'auto_resolved',
          ai_answer: answerResult.answer,
          confidence: answerResult.confidence,
          sources: answerResult.sources,
          summary: null,
          tags: tagResult.tags,
          urgency: tagResult.urgency,
        });
        return updated!;
      } else {
        // Low confidence or insufficient info: Escalate to human agent
        const summary = await aiClient.getSummary(ticketText, answerResult.answer);
        const updated = dbOperations.updateTicketWithAiResult({
          id: ticketId,
          status: 'escalated',
          ai_answer: answerResult.answer || 'INSUFFICIENT_INFO',
          confidence: answerResult.confidence,
          sources: answerResult.sources,
          summary: summary,
          tags: tagResult.tags,
          urgency: tagResult.urgency,
        });
        return updated!;
      }
    } catch (err) {
      console.error('[escalationService] Error processing ticket. Defaulting to escalated:', err);
      // Resilience guarantee: never crash on failure; always escalate safely
      const updated = dbOperations.updateTicketWithAiResult({
        id: ticketId,
        status: 'escalated',
        ai_answer: null,
        confidence: 0,
        sources: [],
        summary: '1. Customer Wants: Assistance requested.\n2. AI Attempted: Processing error encountered.\n3. Suggested Next Step: Human agent manual intervention required.',
        tags: ['other'],
        urgency: 'medium',
      });
      return updated!;
    }
  },
};

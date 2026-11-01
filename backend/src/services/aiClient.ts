import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env from root or local backend
const rootEnv = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');

export interface AiTagResult {
  tags: string[];
  urgency: 'low' | 'medium' | 'high';
}

export interface AiAnswerResult {
  answer: string;
  confidence: number;
  sources: string[];
  needs_human: boolean;
}

export interface AiSummaryResult {
  summary: string;
}

export interface AiIngestResult {
  chunks_stored: number;
  files_processed: string[];
  status: string;
}

export const aiClient = {
  /**
   * Classify ticket into tags and urgency
   */
  async classifyTicket(ticketText: string): Promise<AiTagResult> {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_text: ticketText }),
      });
      if (!response.ok) {
        throw new Error(`AI service /tag responded with status ${response.status}`);
      }
      const data = await response.json() as any;
      return {
        tags: Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : ['other'],
        urgency: data.urgency || 'medium',
      };
    } catch (err) {
      console.warn('[aiClient] /tag failed, falling back to default tags:', err);
      return {
        tags: ['other'],
        urgency: 'medium',
      };
    }
  },

  /**
   * Run RAG question answering with confidence calculation
   */
  async getAnswer(ticketText: string): Promise<AiAnswerResult> {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_text: ticketText }),
      });
      if (!response.ok) {
        throw new Error(`AI service /answer responded with status ${response.status}`);
      }
      const data = await response.json() as any;
      return {
        answer: data.answer || '',
        confidence: typeof data.confidence === 'number' ? data.confidence : 0,
        sources: Array.isArray(data.sources) ? data.sources : [],
        needs_human: Boolean(data.needs_human),
      };
    } catch (err) {
      console.warn('[aiClient] /answer failed or service down. Marking for human escalation:', err);
      return {
        answer: '',
        confidence: 0,
        sources: [],
        needs_human: true,
      };
    }
  },

  /**
   * Generate 3-line briefing summary for human agent
   */
  async getSummary(ticketText: string, attemptedAnswer?: string): Promise<string> {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_text: ticketText,
          attempted_answer: attemptedAnswer || '',
        }),
      });
      if (!response.ok) {
        throw new Error(`AI service /summarize responded with status ${response.status}`);
      }
      const data = await response.json() as any;
      return data.summary || '';
    } catch (err) {
      console.warn('[aiClient] /summarize failed, generating local fallback summary:', err);
      const snippet = ticketText.replace(/\s+/g, ' ').slice(0, 80);
      return `1. Customer Wants: Help with: "${snippet}..."\n2. AI Attempted: System offline or insufficient confidence to answer automatically.\n3. Suggested Next Step: Review customer request and reply directly.`;
    }
  },

  /**
   * Trigger knowledge base re-ingestion in Python service
   */
  async reingestKb(): Promise<AiIngestResult> {
    const response = await fetch(`${AI_SERVICE_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`AI service /ingest failed with status ${response.status}`);
    }
    return await response.json() as AiIngestResult;
  },

  async getHealth(): Promise<{ confidence_threshold?: number }> {
    const response = await fetch(`${AI_SERVICE_URL}/health`);
    if (!response.ok) throw new Error(`AI service /health failed with status ${response.status}`);
    return await response.json() as any;
  },

  async setThreshold(value: number): Promise<number> {
    const response = await fetch(`${AI_SERVICE_URL}/settings/threshold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confidence_threshold: value }),
    });
    if (!response.ok) throw new Error(`AI service /settings/threshold failed with status ${response.status}`);
    const data = await response.json() as any;
    return data.confidence_threshold;
  },

  async learn(items: Array<{ ticket_text: string; human_reply: string }>): Promise<{ added: number; total_learned: number; chunks_stored: number }> {
    const response = await fetch(`${AI_SERVICE_URL}/learn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!response.ok) throw new Error(`AI service /learn failed with status ${response.status}`);
    return await response.json() as any;
  },

  /**
   * Generate analytical insight text for weekly report
   */
  async getInsights(metrics: any): Promise<string> {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics),
      });
      if (response.ok) {
        const data = await response.json() as any;
        if (data.insight) return data.insight;
      }
    } catch (err) {
      console.warn('[aiClient] /insights failed, using analytical fallback:', err);
    }

    const topTag = metrics.top_tags?.[0]?.tag || 'general inquiries';
    const gapList = metrics.knowledge_gaps?.map((g: any) => g.tag).join(', ') || 'none';
    return `During this reporting period, the team handled ${metrics.total_tickets} tickets with an auto-resolution rate of ${metrics.auto_resolved_pct}% and average confidence of ${metrics.avg_confidence}. The most common driver was '${topTag}'.\n\nThe primary knowledge gaps identified were '${gapList}'. Updating support documentation for these topics will directly reduce human escalations.`;
  },
};

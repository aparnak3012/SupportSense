import { Router, Request, Response } from 'express';
import { aiClient } from '../services/aiClient';

export const kbRouter = Router();

/**
 * POST /api/kb/reingest
 * Trigger re-chunking and re-embedding of docs in the Python AI service
 */
kbRouter.post('/reingest', async (_req: Request, res: Response) => {
  try {
    const result = await aiClient.reingestKb();
    res.json({
      message: 'Knowledge base re-ingested successfully',
      ...result,
    });
  } catch (err: any) {
    console.error('Error in POST /api/kb/reingest:', err);
    res.status(500).json({
      error: 'Failed to re-ingest knowledge base',
      details: err?.message,
    });
  }
});

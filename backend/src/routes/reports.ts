import { Router, Request, Response } from 'express';
import { dbOperations } from '../db/database';
import { generateWeeklyReport } from '../services/reportJob';

export const reportsRouter = Router();

/**
 * GET /api/reports/weekly
 * Fetch the latest weekly report, or automatically generate one if no reports exist
 */
reportsRouter.get('/weekly', async (_req: Request, res: Response) => {
  try {
    let latestReport = dbOperations.getLatestReport();

    if (!latestReport) {
      // Auto-generate initial report if database is empty
      latestReport = await generateWeeklyReport();
    }

    res.json(latestReport);
  } catch (err: any) {
    console.error('Error in GET /api/reports/weekly:', err);
    res.status(500).json({ error: 'Failed to retrieve weekly report', details: err?.message });
  }
});

/**
 * POST /api/reports/generate
 * On-demand generation of a weekly report
 */
reportsRouter.post('/generate', async (_req: Request, res: Response) => {
  try {
    const newReport = await generateWeeklyReport();
    res.status(201).json(newReport);
  } catch (err: any) {
    console.error('Error in POST /api/reports/generate:', err);
    res.status(500).json({ error: 'Failed to generate report', details: err?.message });
  }
});

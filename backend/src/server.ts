import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

import { ticketsRouter } from './routes/tickets';
import { reportsRouter } from './routes/reports';
import { kbRouter } from './routes/kb';
import { initReportJob } from './services/reportJob';

// Load environment variables
const rootEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend dashboard from public folder
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

// API Routes
app.use('/api/tickets', ticketsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/kb', kbRouter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SupportSense Backend',
    timestamp: new Date().toISOString(),
  });
});

// Custom 404 route
app.get('/404', (_req, res) => {
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

// API 404 handler for unknown endpoints
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Main dashboard index route
app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Custom 404 fallback for unrecognized page routes
app.get('*', (_req, res) => {
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` SupportSense Backend is running at http://localhost:${PORT}`);
  console.log(` Dashboard is available at http://localhost:${PORT}`);
  console.log(`=======================================================`);

  // Start scheduled node-cron job for weekly reporting
  initReportJob();
});

export { app, server };

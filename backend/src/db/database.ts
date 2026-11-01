import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from parent root or current folder
const projectRoot = path.resolve(__dirname, '../../../');
const envPath = fs.existsSync(path.join(projectRoot, '.env'))
  ? path.join(projectRoot, '.env')
  : path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Database path resolution - anchored to projectRoot so all processes access the exact same DB
const dbPathSetting = process.env.DATABASE_PATH || './data/support_sense.db';
const resolvedDbPath = path.isAbsolute(dbPathSetting)
  ? dbPathSetting
  : path.resolve(projectRoot, dbPathSetting);

// Ensure target directory exists
const dbDir = path.dirname(resolvedDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite connection
export const db = new Database(resolvedDbPath);
db.pragma('journal_mode = WAL');

// Execute initial schema
const schemaCandidates = [
  path.resolve(__dirname, 'schema.sql'),
  path.resolve(__dirname, '../../src/db/schema.sql'),
  path.resolve(process.cwd(), 'src/db/schema.sql'),
  path.resolve(process.cwd(), 'backend/src/db/schema.sql'),
];

let schemaSql = '';
for (const candidate of schemaCandidates) {
  if (fs.existsSync(candidate)) {
    schemaSql = fs.readFileSync(candidate, 'utf-8');
    break;
  }
}

if (!schemaSql) {
  // Built-in fallback schema to guarantee tables exist
  schemaSql = `
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_email TEXT NOT NULL,
      text TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('new', 'auto_resolved', 'escalated', 'human_resolved')),
      ai_answer TEXT,
      confidence REAL,
      sources_json TEXT DEFAULT '[]',
      summary TEXT,
      tags_json TEXT DEFAULT '[]',
      urgency TEXT DEFAULT 'medium' CHECK(urgency IN ('low', 'medium', 'high')),
      human_reply TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      report_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_pairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      ticket_text TEXT NOT NULL,
      human_reply TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
  `;
}

db.exec(schemaSql);

// Interfaces
export interface TicketRecord {
  id: number;
  customer_email: string;
  text: string;
  status: 'new' | 'auto_resolved' | 'escalated' | 'human_resolved';
  ai_answer: string | null;
  confidence: number | null;
  sources_json: string;
  summary: string | null;
  tags_json: string;
  urgency: 'low' | 'medium' | 'high';
  human_reply: string | null;
  created_at: string;
  resolved_at: string | null;
  // Parsed convenience fields
  sources?: string[];
  tags?: string[];
}

export interface ReportRecord {
  id: number;
  week_start: string;
  week_end: string;
  report_json: string;
  created_at: string;
}

export interface FeedbackPairRecord {
  id: number;
  ticket_id: number;
  ticket_text: string;
  human_reply: string;
  created_at: string;
}

// Helper to hydrate JSON columns
export function hydrateTicket(row: any): TicketRecord | null {
  if (!row) return null;
  let sources: string[] = [];
  let tags: string[] = [];

  try {
    sources = row.sources_json ? JSON.parse(row.sources_json) : [];
  } catch {
    sources = [];
  }

  try {
    tags = row.tags_json ? JSON.parse(row.tags_json) : [];
  } catch {
    tags = [];
  }

  return {
    ...row,
    sources,
    tags,
  };
}

// Database helper functions
export const dbOperations = {
  createInitialTicket(customer_email: string, text: string): number {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO tickets (customer_email, text, status, sources_json, tags_json, urgency, created_at)
      VALUES (?, ?, 'new', '[]', '[]', 'medium', ?)
    `);
    const info = stmt.run(customer_email, text, now);
    return Number(info.lastInsertRowid);
  },

  updateTicketWithAiResult(params: {
    id: number;
    status: 'auto_resolved' | 'escalated';
    ai_answer: string | null;
    confidence: number | null;
    sources: string[];
    summary: string | null;
    tags: string[];
    urgency: 'low' | 'medium' | 'high';
  }): TicketRecord | null {
    const resolvedAt = params.status === 'auto_resolved' ? new Date().toISOString() : null;
    const stmt = db.prepare(`
      UPDATE tickets
      SET status = ?,
          ai_answer = ?,
          confidence = ?,
          sources_json = ?,
          summary = ?,
          tags_json = ?,
          urgency = ?,
          resolved_at = ?
      WHERE id = ?
    `);
    stmt.run(
      params.status,
      params.ai_answer,
      params.confidence,
      JSON.stringify(params.sources),
      params.summary,
      JSON.stringify(params.tags),
      params.urgency,
      resolvedAt,
      params.id
    );
    return dbOperations.getTicketById(params.id);
  },

  getTicketById(id: number): TicketRecord | null {
    const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');
    const row = stmt.get(id);
    return hydrateTicket(row);
  },

  listTickets(filter?: { status?: string; tag?: string }): TicketRecord[] {
    let query = 'SELECT * FROM tickets WHERE 1=1';
    const params: any[] = [];

    if (filter?.status && filter.status !== 'all') {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.tag && filter.tag !== 'all') {
      query += ' AND tags_json LIKE ?';
      params.push(`%"${filter.tag}"%`);
    }

    query += ' ORDER BY id DESC';
    const rows = db.prepare(query).all(...params);
    return rows.map(hydrateTicket).filter((t): t is TicketRecord => t !== null);
  },

  resolveTicketWithHumanReply(id: number, human_reply: string): TicketRecord | null {
    const now = new Date().toISOString();
    const ticket = dbOperations.getTicketById(id);
    if (!ticket) return null;

    // Transaction for atomic update of ticket and insertion of feedback pair
    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE tickets
        SET status = 'human_resolved',
            human_reply = ?,
            resolved_at = ?
        WHERE id = ?
      `).run(human_reply, now, id);

      db.prepare(`
        INSERT INTO feedback_pairs (ticket_id, ticket_text, human_reply, created_at)
        VALUES (?, ?, ?, ?)
      `).run(id, ticket.text, human_reply, now);
    });

    updateTx();
    return dbOperations.getTicketById(id);
  },

  saveReport(week_start: string, week_end: string, report: any): number {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO reports (week_start, week_end, report_json, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(week_start, week_end, JSON.stringify(report), now);
    return Number(info.lastInsertRowid);
  },

  getLatestReport(): any | null {
    const stmt = db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 1');
    const row: any = stmt.get();
    if (!row) return null;
    try {
      return {
        id: row.id,
        week_start: row.week_start,
        week_end: row.week_end,
        created_at: row.created_at,
        ...JSON.parse(row.report_json)
      };
    } catch {
      return null;
    }
  },

  getTicketsBetween(startDate: string, endDate: string): TicketRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM tickets
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY id ASC
    `);
    const rows = stmt.all(startDate, endDate);
    return rows.map(hydrateTicket).filter((t): t is TicketRecord => t !== null);
  }
};

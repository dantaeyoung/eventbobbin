import Database from 'better-sqlite3';
import path from 'path';
import { Source, Event } from './types';

const dbPath = path.join(process.cwd(), 'data', 'events.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1,
    lastScrapedAt TEXT,
    lastContentHash TEXT,
    scrapeIntervalHours INTEGER NOT NULL DEFAULT 24,
    scrapeInstructions TEXT,
    scrapingStartedAt TEXT,
    tags TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    sourceId TEXT NOT NULL,
    title TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT,
    location TEXT,
    description TEXT,
    url TEXT,
    imageUrl TEXT,
    rawData TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    scrapedAt TEXT NOT NULL,
    FOREIGN KEY (sourceId) REFERENCES sources(id) ON DELETE CASCADE,
    UNIQUE(sourceId, title, startDate)
  );

  CREATE INDEX IF NOT EXISTS idx_events_startDate ON events(startDate);
  CREATE INDEX IF NOT EXISTS idx_events_sourceId ON events(sourceId);
`);

// Migration: Add imageUrl column if it doesn't exist
try {
  db.exec(`ALTER TABLE events ADD COLUMN imageUrl TEXT`);
} catch {
  // Column already exists, ignore
}

// Migration: Add scrapeInstructions column if it doesn't exist
try {
  db.exec(`ALTER TABLE sources ADD COLUMN scrapeInstructions TEXT`);
} catch {
  // Column already exists, ignore
}

// Migration: Add scrapingStartedAt column if it doesn't exist
try {
  db.exec(`ALTER TABLE sources ADD COLUMN scrapingStartedAt TEXT`);
} catch {
  // Column already exists, ignore
}

// Migration: Add tags column if it doesn't exist
try {
  db.exec(`ALTER TABLE sources ADD COLUMN tags TEXT`);
} catch {
  // Column already exists, ignore
}

// Migration: Add logoUrl column if it doesn't exist
try {
  db.exec(`ALTER TABLE sources ADD COLUMN logoUrl TEXT`);
} catch {
  // Column already exists, ignore
}

// Settings table for app-wide settings (like squiggle positions)
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Stats table for tracking LLM usage
db.exec(`
  CREATE TABLE IF NOT EXISTS llm_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sourceId TEXT,
    model TEXT NOT NULL,
    promptTokens INTEGER NOT NULL,
    completionTokens INTEGER NOT NULL,
    totalTokens INTEGER NOT NULL,
    cost REAL NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sourceId) REFERENCES sources(id) ON DELETE SET NULL
  );
`);

// Settings queries
export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO settings (key, value, updatedAt)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = datetime('now')
  `).run(key, value);
}

// Source queries
export function getAllSources(): Source[] {
  return db.prepare('SELECT * FROM sources ORDER BY name').all() as Source[];
}

export function getEnabledSources(): Source[] {
  return db.prepare('SELECT * FROM sources WHERE enabled = 1 ORDER BY name').all() as Source[];
}

export function getSourceById(id: string): Source | undefined {
  return db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as Source | undefined;
}

export function createSource(source: Omit<Source, 'createdAt'>): Source {
  const stmt = db.prepare(`
    INSERT INTO sources (id, name, url, enabled, lastScrapedAt, lastContentHash, scrapeIntervalHours, scrapeInstructions, scrapingStartedAt, tags, logoUrl)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    source.id,
    source.name,
    source.url,
    source.enabled ? 1 : 0,
    source.lastScrapedAt,
    source.lastContentHash,
    source.scrapeIntervalHours,
    source.scrapeInstructions,
    source.scrapingStartedAt,
    source.tags,
    source.logoUrl
  );
  return getSourceById(source.id)!;
}

export function updateSource(id: string, updates: Partial<Source>): Source | undefined {
  const current = getSourceById(id);
  if (!current) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.url !== undefined) {
    fields.push('url = ?');
    values.push(updates.url);
  }
  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }
  if (updates.lastScrapedAt !== undefined) {
    fields.push('lastScrapedAt = ?');
    values.push(updates.lastScrapedAt);
  }
  if (updates.lastContentHash !== undefined) {
    fields.push('lastContentHash = ?');
    values.push(updates.lastContentHash);
  }
  if (updates.scrapeIntervalHours !== undefined) {
    fields.push('scrapeIntervalHours = ?');
    values.push(updates.scrapeIntervalHours);
  }
  if (updates.scrapeInstructions !== undefined) {
    fields.push('scrapeInstructions = ?');
    values.push(updates.scrapeInstructions);
  }
  if (updates.scrapingStartedAt !== undefined) {
    fields.push('scrapingStartedAt = ?');
    values.push(updates.scrapingStartedAt);
  }
  if (updates.tags !== undefined) {
    fields.push('tags = ?');
    values.push(updates.tags);
  }
  if (updates.logoUrl !== undefined) {
    fields.push('logoUrl = ?');
    values.push(updates.logoUrl);
  }

  if (fields.length === 0) return current;

  values.push(id);
  db.prepare(`UPDATE sources SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getSourceById(id);
}

export function deleteSource(id: string): boolean {
  const result = db.prepare('DELETE FROM sources WHERE id = ?').run(id);
  return result.changes > 0;
}

// Event queries
export function getEvents(options: {
  sourceIds?: string[];
  from?: string;
  to?: string;
  limit?: number;
}): Event[] {
  let query = 'SELECT * FROM events WHERE 1=1';
  const params: unknown[] = [];

  if (options.sourceIds && options.sourceIds.length > 0) {
    query += ` AND sourceId IN (${options.sourceIds.map(() => '?').join(',')})`;
    params.push(...options.sourceIds);
  }

  if (options.from) {
    query += ' AND startDate >= ?';
    params.push(options.from);
  }

  if (options.to) {
    query += ' AND startDate <= ?';
    params.push(options.to);
  }

  query += ' ORDER BY startDate ASC';

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.prepare(query).all(...params) as Event[];
}

export function upsertEvent(event: Omit<Event, 'createdAt' | 'updatedAt'>): void {
  const stmt = db.prepare(`
    INSERT INTO events (id, sourceId, title, startDate, endDate, location, description, url, imageUrl, rawData, scrapedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sourceId, title, startDate) DO UPDATE SET
      endDate = excluded.endDate,
      location = excluded.location,
      description = excluded.description,
      url = excluded.url,
      imageUrl = excluded.imageUrl,
      rawData = excluded.rawData,
      updatedAt = datetime('now'),
      scrapedAt = excluded.scrapedAt
  `);
  stmt.run(
    event.id,
    event.sourceId,
    event.title,
    event.startDate,
    event.endDate,
    event.location,
    event.description,
    event.url,
    event.imageUrl,
    event.rawData,
    event.scrapedAt
  );
}

export function deleteEventsBySource(sourceId: string): number {
  const result = db.prepare('DELETE FROM events WHERE sourceId = ?').run(sourceId);
  return result.changes;
}

// LLM usage tracking
export interface LLMUsage {
  id: number;
  sourceId: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  createdAt: string;
}

export function recordLLMUsage(usage: Omit<LLMUsage, 'id' | 'createdAt'>): void {
  db.prepare(`
    INSERT INTO llm_usage (sourceId, model, promptTokens, completionTokens, totalTokens, cost)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    usage.sourceId,
    usage.model,
    usage.promptTokens,
    usage.completionTokens,
    usage.totalTokens,
    usage.cost
  );
}

export function getLLMStats(): {
  totalCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCost: number;
  recentUsage: LLMUsage[];
} {
  const totals = db.prepare(`
    SELECT
      COUNT(*) as totalCalls,
      COALESCE(SUM(promptTokens), 0) as totalPromptTokens,
      COALESCE(SUM(completionTokens), 0) as totalCompletionTokens,
      COALESCE(SUM(totalTokens), 0) as totalTokens,
      COALESCE(SUM(cost), 0) as totalCost
    FROM llm_usage
  `).get() as {
    totalCalls: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCost: number;
  };

  const recentUsage = db.prepare(`
    SELECT * FROM llm_usage ORDER BY createdAt DESC LIMIT 20
  `).all() as LLMUsage[];

  return { ...totals, recentUsage };
}

export function getEventStats(): {
  totalEvents: number;
  totalSources: number;
  enabledSources: number;
  eventsThisMonth: number;
} {
  const totalEvents = (db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number }).count;
  const totalSources = (db.prepare('SELECT COUNT(*) as count FROM sources').get() as { count: number }).count;
  const enabledSources = (db.prepare('SELECT COUNT(*) as count FROM sources WHERE enabled = 1').get() as { count: number }).count;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const eventsThisMonth = (db.prepare('SELECT COUNT(*) as count FROM events WHERE startDate >= ?').get(startOfMonth.toISOString()) as { count: number }).count;

  return { totalEvents, totalSources, enabledSources, eventsThisMonth };
}

export { db };

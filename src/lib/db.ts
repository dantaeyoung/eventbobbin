import { neon, Pool } from '@neondatabase/serverless';
import { Source, Event } from './types';

const sql = neon(process.env.DATABASE_URL!);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Helper to convert date to ISO string (PostgreSQL returns Date objects)
function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

function toISOStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toISOString(value);
}

// Helper to convert snake_case DB rows to camelCase
function sourceFromRow(row: Record<string, unknown>): Source {
  return {
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    enabled: row.enabled as boolean,
    lastScrapedAt: toISOStringOrNull(row.last_scraped_at),
    lastContentHash: row.last_content_hash as string | null,
    scrapeIntervalHours: row.scrape_interval_hours as number,
    scrapeInstructions: row.scrape_instructions as string | null,
    scrapingStartedAt: toISOStringOrNull(row.scraping_started_at),
    tags: row.tags as string | null,
    logoUrl: row.logo_url as string | null,
    city: row.city as string | null,
    createdAt: toISOString(row.created_at),
  };
}

function eventFromRow(row: Record<string, unknown>): Event {
  return {
    id: row.id as string,
    sourceId: row.source_id as string,
    title: row.title as string,
    startDate: toISOString(row.start_date),
    endDate: toISOStringOrNull(row.end_date),
    location: row.location as string | null,
    description: row.description as string | null,
    url: row.url as string | null,
    imageUrl: row.image_url as string | null,
    rawData: typeof row.raw_data === 'string' ? row.raw_data : JSON.stringify(row.raw_data),
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
    scrapedAt: toISOString(row.scraped_at),
  };
}

// Settings queries
export async function getSetting(key: string): Promise<string | null> {
  const rows = await sql`SELECT value FROM settings WHERE key = ${key}`;
  if (rows.length === 0) return null;
  const value = rows[0].value;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sql`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${key}, ${value}::jsonb, NOW())
    ON CONFLICT(key) DO UPDATE SET value = ${value}::jsonb, updated_at = NOW()
  `;
}

// Source queries
export async function getAllSources(): Promise<Source[]> {
  const rows = await sql`SELECT * FROM sources ORDER BY name`;
  return rows.map(sourceFromRow);
}

export async function getEnabledSources(): Promise<Source[]> {
  const rows = await sql`SELECT * FROM sources WHERE enabled = TRUE ORDER BY name`;
  return rows.map(sourceFromRow);
}

export async function getSourceById(id: string): Promise<Source | undefined> {
  const rows = await sql`SELECT * FROM sources WHERE id = ${id}`;
  if (rows.length === 0) return undefined;
  return sourceFromRow(rows[0]);
}

export async function createSource(source: Omit<Source, 'createdAt'>): Promise<Source> {
  const rows = await sql`
    INSERT INTO sources (id, name, url, enabled, last_scraped_at, last_content_hash, scrape_interval_hours, scrape_instructions, scraping_started_at, tags, logo_url, city)
    VALUES (${source.id}, ${source.name}, ${source.url}, ${source.enabled}, ${source.lastScrapedAt}, ${source.lastContentHash}, ${source.scrapeIntervalHours}, ${source.scrapeInstructions}, ${source.scrapingStartedAt}, ${source.tags}, ${source.logoUrl}, ${source.city})
    RETURNING *
  `;
  return sourceFromRow(rows[0]);
}

export async function updateSource(id: string, updates: Partial<Source>): Promise<Source | undefined> {
  const current = await getSourceById(id);
  if (!current) return undefined;

  // Build dynamic update - PostgreSQL style
  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    sets.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.url !== undefined) {
    sets.push(`url = $${paramIndex++}`);
    values.push(updates.url);
  }
  if (updates.enabled !== undefined) {
    sets.push(`enabled = $${paramIndex++}`);
    values.push(updates.enabled);
  }
  if (updates.lastScrapedAt !== undefined) {
    sets.push(`last_scraped_at = $${paramIndex++}`);
    values.push(updates.lastScrapedAt);
  }
  if (updates.lastContentHash !== undefined) {
    sets.push(`last_content_hash = $${paramIndex++}`);
    values.push(updates.lastContentHash);
  }
  if (updates.scrapeIntervalHours !== undefined) {
    sets.push(`scrape_interval_hours = $${paramIndex++}`);
    values.push(updates.scrapeIntervalHours);
  }
  if (updates.scrapeInstructions !== undefined) {
    sets.push(`scrape_instructions = $${paramIndex++}`);
    values.push(updates.scrapeInstructions);
  }
  if (updates.scrapingStartedAt !== undefined) {
    sets.push(`scraping_started_at = $${paramIndex++}`);
    values.push(updates.scrapingStartedAt);
  }
  if (updates.tags !== undefined) {
    sets.push(`tags = $${paramIndex++}`);
    values.push(updates.tags);
  }
  if (updates.logoUrl !== undefined) {
    sets.push(`logo_url = $${paramIndex++}`);
    values.push(updates.logoUrl);
  }
  if (updates.city !== undefined) {
    sets.push(`city = $${paramIndex++}`);
    values.push(updates.city);
  }

  if (sets.length === 0) return current;

  values.push(id);
  const query = `UPDATE sources SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  // Use pool.query for dynamic parameterized queries
  const result = await pool.query(query, values);
  return sourceFromRow(result.rows[0]);
}

export async function deleteSource(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM sources WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// Event queries
export async function getEvents(options: {
  sourceIds?: string[];
  from?: string;
  to?: string;
  limit?: number;
}): Promise<Event[]> {
  // Build query dynamically
  const conditions: string[] = ['1=1'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (options.sourceIds && options.sourceIds.length > 0) {
    const placeholders = options.sourceIds.map(() => `$${paramIndex++}`).join(',');
    conditions.push(`source_id IN (${placeholders})`);
    values.push(...options.sourceIds);
  }

  if (options.from) {
    conditions.push(`start_date >= $${paramIndex++}`);
    values.push(options.from);
  }

  if (options.to) {
    conditions.push(`start_date <= $${paramIndex++}`);
    values.push(options.to);
  }

  let query = `SELECT * FROM events WHERE ${conditions.join(' AND ')} ORDER BY start_date ASC`;

  if (options.limit) {
    query += ` LIMIT $${paramIndex++}`;
    values.push(options.limit);
  }

  // Use pool.query for dynamic parameterized queries
  const result = await pool.query(query, values);
  return result.rows.map(eventFromRow);
}

export async function getEventById(id: string): Promise<Event | undefined> {
  const rows = await sql`SELECT * FROM events WHERE id = ${id}`;
  if (rows.length === 0) return undefined;
  return eventFromRow(rows[0]);
}

export async function upsertEvent(event: Omit<Event, 'createdAt' | 'updatedAt'>): Promise<void> {
  const rawDataJson = typeof event.rawData === 'string' ? event.rawData : JSON.stringify(event.rawData);

  await sql`
    INSERT INTO events (id, source_id, title, start_date, end_date, location, description, url, image_url, raw_data, scraped_at)
    VALUES (${event.id}, ${event.sourceId}, ${event.title}, ${event.startDate}, ${event.endDate}, ${event.location}, ${event.description}, ${event.url}, ${event.imageUrl}, ${rawDataJson}::jsonb, ${event.scrapedAt})
    ON CONFLICT(source_id, title, start_date) DO UPDATE SET
      end_date = EXCLUDED.end_date,
      location = EXCLUDED.location,
      description = EXCLUDED.description,
      url = EXCLUDED.url,
      image_url = EXCLUDED.image_url,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW(),
      scraped_at = EXCLUDED.scraped_at
  `;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM events WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function deleteEventsBySource(sourceId: string): Promise<number> {
  const result = await pool.query('DELETE FROM events WHERE source_id = $1', [sourceId]);
  return result.rowCount ?? 0;
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

export async function recordLLMUsage(usage: Omit<LLMUsage, 'id' | 'createdAt'>): Promise<void> {
  await sql`
    INSERT INTO llm_usage (source_id, model, prompt_tokens, completion_tokens, total_tokens, cost)
    VALUES (${usage.sourceId}, ${usage.model}, ${usage.promptTokens}, ${usage.completionTokens}, ${usage.totalTokens}, ${usage.cost})
  `;
}

export async function getLLMStats(): Promise<{
  totalCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCost: number;
  recentUsage: LLMUsage[];
}> {
  const totalsRows = await sql`
    SELECT
      COUNT(*) as total_calls,
      COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
      COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(SUM(cost), 0) as total_cost
    FROM llm_usage
  `;

  const recentRows = await sql`
    SELECT * FROM llm_usage ORDER BY created_at DESC LIMIT 20
  `;

  const totals = totalsRows[0];
  const recentUsage: LLMUsage[] = recentRows.map(row => ({
    id: row.id as number,
    sourceId: row.source_id as string | null,
    model: row.model as string,
    promptTokens: row.prompt_tokens as number,
    completionTokens: row.completion_tokens as number,
    totalTokens: row.total_tokens as number,
    cost: Number(row.cost),
    createdAt: row.created_at as string,
  }));

  return {
    totalCalls: Number(totals.total_calls),
    totalPromptTokens: Number(totals.total_prompt_tokens),
    totalCompletionTokens: Number(totals.total_completion_tokens),
    totalTokens: Number(totals.total_tokens),
    totalCost: Number(totals.total_cost),
    recentUsage,
  };
}

export async function getEventStats(): Promise<{
  totalEvents: number;
  totalSources: number;
  enabledSources: number;
  eventsThisMonth: number;
}> {
  const [eventsRow] = await sql`SELECT COUNT(*) as count FROM events`;
  const [sourcesRow] = await sql`SELECT COUNT(*) as count FROM sources`;
  const [enabledRow] = await sql`SELECT COUNT(*) as count FROM sources WHERE enabled = TRUE`;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const [monthRow] = await sql`SELECT COUNT(*) as count FROM events WHERE start_date >= ${startOfMonth.toISOString()}`;

  return {
    totalEvents: Number(eventsRow.count),
    totalSources: Number(sourcesRow.count),
    enabledSources: Number(enabledRow.count),
    eventsThisMonth: Number(monthRow.count),
  };
}

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, gte, lte, inArray, desc, sum, count } from 'drizzle-orm';
import * as schema from './schema';
import { sources, events, settings, llmUsage, users, subscriptions } from './schema';
import type { Source, Event } from './types';

const client = neon(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });

// Helper to convert Date to ISO string
function toISOString(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function toISOStringRequired(value: Date): string {
  return value.toISOString();
}

// Transform Drizzle source row to our Source type (with string dates)
function transformSource(row: typeof sources.$inferSelect): Source {
  return {
    ...row,
    lastScrapedAt: toISOString(row.lastScrapedAt),
    scrapingStartedAt: toISOString(row.scrapingStartedAt),
    createdAt: toISOStringRequired(row.createdAt),
  };
}

// Transform Drizzle event row to our Event type (with string dates)
function transformEvent(row: typeof events.$inferSelect): Event {
  return {
    ...row,
    startDate: toISOStringRequired(row.startDate),
    endDate: toISOString(row.endDate),
    createdAt: toISOStringRequired(row.createdAt),
    updatedAt: toISOStringRequired(row.updatedAt),
    scrapedAt: toISOStringRequired(row.scrapedAt),
  };
}

// LLM usage type with string dates
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

function transformLLMUsage(row: typeof llmUsage.$inferSelect): LLMUsage {
  return {
    ...row,
    cost: Number(row.cost),
    createdAt: toISOStringRequired(row.createdAt),
  };
}

// Settings queries
export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key));
  if (rows.length === 0) return null;
  const value = rows[0].value;
  // Handle both string and object values (PostgreSQL jsonb returns parsed objects)
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });
}

// Source queries
export async function getAllSources(): Promise<Source[]> {
  const rows = await db.select().from(sources).orderBy(sources.name);
  return rows.map(transformSource);
}

export async function getEnabledSources(): Promise<Source[]> {
  const rows = await db.select().from(sources).where(eq(sources.enabled, true)).orderBy(sources.name);
  return rows.map(transformSource);
}

export async function getSourceById(id: string): Promise<Source | undefined> {
  const rows = await db.select().from(sources).where(eq(sources.id, id));
  if (rows.length === 0) return undefined;
  return transformSource(rows[0]);
}

export async function createSource(source: Omit<Source, 'createdAt'>): Promise<Source> {
  const rows = await db.insert(sources).values({
    ...source,
    lastScrapedAt: source.lastScrapedAt ? new Date(source.lastScrapedAt) : null,
    scrapingStartedAt: source.scrapingStartedAt ? new Date(source.scrapingStartedAt) : null,
  }).returning();
  return transformSource(rows[0]);
}

export async function updateSource(id: string, updates: Partial<Source>): Promise<Source | undefined> {
  // Convert string dates to Date objects for Drizzle
  const drizzleUpdates: Partial<typeof sources.$inferInsert> = {};

  if (updates.name !== undefined) drizzleUpdates.name = updates.name;
  if (updates.url !== undefined) drizzleUpdates.url = updates.url;
  if (updates.enabled !== undefined) drizzleUpdates.enabled = updates.enabled;
  if (updates.lastScrapedAt !== undefined) {
    drizzleUpdates.lastScrapedAt = updates.lastScrapedAt ? new Date(updates.lastScrapedAt) : null;
  }
  if (updates.lastContentHash !== undefined) drizzleUpdates.lastContentHash = updates.lastContentHash;
  if (updates.scrapeIntervalHours !== undefined) drizzleUpdates.scrapeIntervalHours = updates.scrapeIntervalHours;
  if (updates.scrapeInstructions !== undefined) drizzleUpdates.scrapeInstructions = updates.scrapeInstructions;
  if (updates.scrapingStartedAt !== undefined) {
    drizzleUpdates.scrapingStartedAt = updates.scrapingStartedAt ? new Date(updates.scrapingStartedAt) : null;
  }
  if (updates.tags !== undefined) drizzleUpdates.tags = updates.tags;
  if (updates.logoUrl !== undefined) drizzleUpdates.logoUrl = updates.logoUrl;
  if (updates.city !== undefined) drizzleUpdates.city = updates.city;

  const rows = await db.update(sources)
    .set(drizzleUpdates)
    .where(eq(sources.id, id))
    .returning();

  if (rows.length === 0) return undefined;
  return transformSource(rows[0]);
}

export async function deleteSource(id: string): Promise<boolean> {
  const result = await db.delete(sources).where(eq(sources.id, id)).returning();
  return result.length > 0;
}

// Event queries
export async function getEvents(options: {
  sourceIds?: string[];
  from?: string;
  to?: string;
  limit?: number;
}): Promise<Event[]> {
  const conditions = [];

  if (options.sourceIds && options.sourceIds.length > 0) {
    conditions.push(inArray(events.sourceId, options.sourceIds));
  }

  if (options.from) {
    conditions.push(gte(events.startDate, new Date(options.from)));
  }

  if (options.to) {
    conditions.push(lte(events.startDate, new Date(options.to)));
  }

  let query = db.select().from(events);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  query = query.orderBy(events.startDate) as typeof query;

  if (options.limit) {
    query = query.limit(options.limit) as typeof query;
  }

  const rows = await query;
  return rows.map(transformEvent);
}

export async function getEventById(id: string): Promise<Event | undefined> {
  const rows = await db.select().from(events).where(eq(events.id, id));
  if (rows.length === 0) return undefined;
  return transformEvent(rows[0]);
}

export async function upsertEvent(event: Omit<Event, 'createdAt' | 'updatedAt'>): Promise<void> {
  const rawData = typeof event.rawData === 'string' ? event.rawData : JSON.stringify(event.rawData);

  await db.insert(events)
    .values({
      id: event.id,
      sourceId: event.sourceId,
      title: event.title,
      startDate: new Date(event.startDate),
      endDate: event.endDate ? new Date(event.endDate) : null,
      location: event.location,
      description: event.description,
      url: event.url,
      imageUrl: event.imageUrl,
      rawData,
      scrapedAt: new Date(event.scrapedAt),
    })
    .onConflictDoUpdate({
      target: [events.sourceId, events.title, events.startDate],
      set: {
        endDate: event.endDate ? new Date(event.endDate) : null,
        location: event.location,
        description: event.description,
        url: event.url,
        imageUrl: event.imageUrl,
        rawData,
        updatedAt: new Date(),
        scrapedAt: new Date(event.scrapedAt),
      },
    });
}

export async function deleteEvent(id: string): Promise<boolean> {
  const result = await db.delete(events).where(eq(events.id, id)).returning();
  return result.length > 0;
}

export async function deleteEventsBySource(sourceId: string): Promise<number> {
  const result = await db.delete(events).where(eq(events.sourceId, sourceId)).returning();
  return result.length;
}

// LLM usage tracking
export async function recordLLMUsage(usage: Omit<LLMUsage, 'id' | 'createdAt'>): Promise<void> {
  await db.insert(llmUsage).values({
    sourceId: usage.sourceId,
    model: usage.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    cost: String(usage.cost),
  });
}

export async function getLLMStats(): Promise<{
  totalCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCost: number;
  recentUsage: LLMUsage[];
}> {
  const totalsResult = await db.select({
    totalCalls: count(),
    totalPromptTokens: sum(llmUsage.promptTokens),
    totalCompletionTokens: sum(llmUsage.completionTokens),
    totalTokens: sum(llmUsage.totalTokens),
    totalCost: sum(llmUsage.cost),
  }).from(llmUsage);

  const recentRows = await db.select()
    .from(llmUsage)
    .orderBy(desc(llmUsage.createdAt))
    .limit(20);

  const totals = totalsResult[0];

  return {
    totalCalls: Number(totals.totalCalls) || 0,
    totalPromptTokens: Number(totals.totalPromptTokens) || 0,
    totalCompletionTokens: Number(totals.totalCompletionTokens) || 0,
    totalTokens: Number(totals.totalTokens) || 0,
    totalCost: Number(totals.totalCost) || 0,
    recentUsage: recentRows.map(transformLLMUsage),
  };
}

export async function getEventStats(): Promise<{
  totalEvents: number;
  totalSources: number;
  enabledSources: number;
  eventsThisMonth: number;
}> {
  const [eventsResult] = await db.select({ count: count() }).from(events);
  const [sourcesResult] = await db.select({ count: count() }).from(sources);
  const [enabledResult] = await db.select({ count: count() }).from(sources).where(eq(sources.enabled, true));

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [monthResult] = await db.select({ count: count() })
    .from(events)
    .where(gte(events.startDate, startOfMonth));

  return {
    totalEvents: eventsResult.count,
    totalSources: sourcesResult.count,
    enabledSources: enabledResult.count,
    eventsThisMonth: monthResult.count,
  };
}

// User queries
export async function getUserById(id: string) {
  const rows = await db.select().from(users).where(eq(users.id, id));
  return rows[0];
}

export async function getUserByEmail(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email));
  return rows[0];
}

export async function createUser(user: { id: string; email: string; name?: string }) {
  const rows = await db.insert(users).values(user).returning();
  return rows[0];
}

// Subscription queries
export async function getUserSubscriptions(userId: string) {
  return db.select()
    .from(subscriptions)
    .innerJoin(sources, eq(subscriptions.sourceId, sources.id))
    .where(eq(subscriptions.userId, userId));
}

export async function subscribeToSource(userId: string, sourceId: string) {
  const id = crypto.randomUUID();
  await db.insert(subscriptions)
    .values({ id, userId, sourceId })
    .onConflictDoNothing();
}

export async function unsubscribeFromSource(userId: string, sourceId: string) {
  await db.delete(subscriptions)
    .where(and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.sourceId, sourceId)
    ));
}

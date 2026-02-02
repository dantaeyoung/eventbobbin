import { pgTable, text, boolean, integer, timestamp, decimal, serial, unique } from 'drizzle-orm/pg-core';

export const sources = pgTable('sources', {
  id: text('id').primaryKey(),
  numericId: serial('numeric_id').notNull().unique(), // Auto-increment ID for URL encoding (never reused)
  name: text('name').notNull(),
  url: text('url').notNull().unique(),
  enabled: boolean('enabled').notNull().default(true),
  lastScrapedAt: timestamp('last_scraped_at', { withTimezone: true }),
  lastContentHash: text('last_content_hash'),
  scrapeIntervalHours: integer('scrape_interval_hours').notNull().default(24),
  scrapeInstructions: text('scrape_instructions'),
  scrapingStartedAt: timestamp('scraping_started_at', { withTimezone: true }),
  tags: text('tags'),
  logoUrl: text('logo_url'),
  logoData: text('logo_data'), // base64 encoded image with data URI prefix
  city: text('city'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  location: text('location'),
  description: text('description'),
  url: text('url'),
  imageUrl: text('image_url'),
  rawData: text('raw_data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  scrapedAt: timestamp('scraped_at', { withTimezone: true }).notNull(),
}, (table) => ({
  uniqueEvent: unique().on(table.sourceId, table.title, table.startDate),
}));

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const llmUsage = pgTable('llm_usage', {
  id: serial('id').primaryKey(),
  sourceId: text('source_id').references(() => sources.id, { onDelete: 'set null' }),
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  cost: decimal('cost', { precision: 10, scale: 6 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceId: text('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueSubscription: unique().on(table.userId, table.sourceId),
}));

// Type exports
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type LLMUsage = typeof llmUsage.$inferSelect;
export type User = typeof users.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;

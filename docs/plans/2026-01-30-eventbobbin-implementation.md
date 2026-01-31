# EventBobbin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an event aggregation website that scrapes multiple sources using Playwright, extracts events via LLM, and displays them in a filterable list.

**Architecture:** Next.js app with SQLite database. Separate scraper script runs via cron, renders pages with Playwright, extracts events using GPT-4o-mini, and upserts to database. Frontend reads from database and displays filterable event list.

**Tech Stack:** Next.js 14 (App Router), TypeScript, SQLite (better-sqlite3), Playwright, OpenAI API, Tailwind CSS

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

**Step 1: Initialize Next.js project**

Run:
```bash
cd /Users/provolot/github/eventbobbin
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

When prompted, accept defaults (Yes to all).

Expected: Project scaffolded with Next.js, TypeScript, Tailwind, ESLint.

**Step 2: Install additional dependencies**

Run:
```bash
npm install better-sqlite3 openai playwright date-fns
npm install -D @types/better-sqlite3 tsx
```

Expected: Dependencies added to package.json.

**Step 3: Install Playwright browsers**

Run:
```bash
npx playwright install chromium
```

Expected: Chromium browser downloaded for Playwright.

**Step 4: Create .env.example**

Create `.env.example`:
```
OPENAI_API_KEY=sk-your-key-here
```

**Step 5: Update .gitignore**

Append to `.gitignore`:
```
# Database
data/*.db
data/*.db-journal

# Environment
.env
.env.local
```

**Step 6: Create data directory**

Run:
```bash
mkdir -p data
touch data/.gitkeep
```

**Step 7: Verify setup**

Run:
```bash
npm run dev
```

Expected: Server starts at http://localhost:3000, default Next.js page loads.

**Step 8: Commit**

Run:
```bash
git add -A
git commit -m "feat: initialize Next.js project with dependencies"
```

---

## Task 2: Database Schema and Types

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/db.ts`

**Step 1: Create shared types**

Create `src/lib/types.ts`:
```typescript
export interface Source {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastScrapedAt: string | null;
  lastContentHash: string | null;
  scrapeIntervalHours: number;
  createdAt: string;
}

export interface Event {
  id: string;
  sourceId: string;
  title: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  rawData: string;
  createdAt: string;
  updatedAt: string;
  scrapedAt: string;
}

export interface ExtractedEvent {
  title: string;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  description?: string | null;
  url?: string | null;
}
```

**Step 2: Create database module**

Create `src/lib/db.ts`:
```typescript
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
    INSERT INTO sources (id, name, url, enabled, lastScrapedAt, lastContentHash, scrapeIntervalHours)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    source.id,
    source.name,
    source.url,
    source.enabled ? 1 : 0,
    source.lastScrapedAt,
    source.lastContentHash,
    source.scrapeIntervalHours
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
    INSERT INTO events (id, sourceId, title, startDate, endDate, location, description, url, rawData, scrapedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sourceId, title, startDate) DO UPDATE SET
      endDate = excluded.endDate,
      location = excluded.location,
      description = excluded.description,
      url = excluded.url,
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
    event.rawData,
    event.scrapedAt
  );
}

export function deleteEventsBySource(sourceId: string): number {
  const result = db.prepare('DELETE FROM events WHERE sourceId = ?').run(sourceId);
  return result.changes;
}

export { db };
```

**Step 3: Test database initialization**

Run:
```bash
npx tsx -e "import './src/lib/db'; console.log('DB initialized')"
```

Expected: "DB initialized" printed, `data/events.db` file created.

**Step 4: Commit**

Run:
```bash
git add src/lib/types.ts src/lib/db.ts data/.gitkeep
git commit -m "feat: add database schema and query functions"
```

---

## Task 3: Scraper - Browser Rendering

**Files:**
- Create: `src/lib/scraper/browser.ts`

**Step 1: Create browser module**

Create `src/lib/scraper/browser.ts`:
```typescript
import { chromium, Browser, Page } from 'playwright';
import crypto from 'crypto';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export interface PageContent {
  text: string;
  links: { text: string; href: string }[];
  hash: string;
}

export async function renderPage(url: string): Promise<PageContent> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Navigate to page
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Scroll to trigger lazy loading
    await autoScroll(page);

    // Wait a bit for any final renders
    await page.waitForTimeout(1000);

    // Extract visible text
    const text = await page.evaluate(() => {
      return document.body.innerText || '';
    });

    // Extract all links
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors
        .map((a) => ({
          text: (a.textContent || '').trim(),
          href: (a as HTMLAnchorElement).href,
        }))
        .filter((link) => link.href && link.text);
    });

    // Generate hash for change detection
    const hash = crypto.createHash('md5').update(text).digest('hex');

    return { text, links, hash };
  } finally {
    await page.close();
  }
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);

      // Safety timeout
      setTimeout(() => {
        clearInterval(timer);
        resolve();
      }, 5000);
    });
  });
}
```

**Step 2: Test browser rendering**

Run:
```bash
npx tsx -e "
import { renderPage, closeBrowser } from './src/lib/scraper/browser';

async function test() {
  const result = await renderPage('https://www.lightandsound.design/');
  console.log('Text length:', result.text.length);
  console.log('Links found:', result.links.length);
  console.log('Hash:', result.hash);
  await closeBrowser();
}
test();
"
```

Expected: Text length, links count, and hash printed.

**Step 3: Commit**

Run:
```bash
git add src/lib/scraper/browser.ts
git commit -m "feat: add Playwright browser rendering module"
```

---

## Task 4: Scraper - LLM Extraction

**Files:**
- Create: `src/lib/scraper/extract.ts`
- Create: `src/lib/scraper/prompt.ts`

**Step 1: Create prompt template**

Create `src/lib/scraper/prompt.ts`:
```typescript
export function buildExtractionPrompt(
  pageText: string,
  links: { text: string; href: string }[],
  currentDate: string
): string {
  const linksText = links
    .slice(0, 100) // Limit to avoid token overflow
    .map((l) => `- "${l.text}" -> ${l.href}`)
    .join('\n');

  return `You are an event extraction assistant. Extract all events from the following webpage content.

CURRENT DATE: ${currentDate}

IMPORTANT RULES:
1. Only extract actual events with specific dates. Do not invent events.
2. If no events are found, return an empty array: []
3. For dates without a year, assume the upcoming occurrence (use ${currentDate.slice(0, 4)} or next year if the date has passed).
4. Parse various date formats: "Feb 3", "2/3/2026", "February 3rd", etc.
5. Parse various time formats: "7pm", "7:00 PM", "19:00", etc.
6. Convert all dates to ISO format: YYYY-MM-DDTHH:MM:SS
7. If only a date is given without time, use T00:00:00
8. Extract event URLs from the links section when available.

PAGE TEXT:
${pageText.slice(0, 15000)}

LINKS ON PAGE:
${linksText}

Respond with a JSON array of events. Each event should have:
- title (string, required): The event name
- startDate (string, required): ISO format date/time
- endDate (string, optional): ISO format date/time if specified
- location (string, optional): Venue name and/or address
- description (string, optional): Brief description if available
- url (string, optional): Direct link to event details

Example response:
[
  {
    "title": "Dance Workshop",
    "startDate": "2026-02-15T19:00:00",
    "endDate": "2026-02-15T21:00:00",
    "location": "123 Main St, New York",
    "description": "Learn contemporary dance techniques",
    "url": "https://example.com/events/dance-workshop"
  }
]

JSON ARRAY:`;
}
```

**Step 2: Create extraction module**

Create `src/lib/scraper/extract.ts`:
```typescript
import OpenAI from 'openai';
import { ExtractedEvent } from '../types';
import { buildExtractionPrompt } from './prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractEvents(
  pageText: string,
  links: { text: string; href: string }[]
): Promise<ExtractedEvent[]> {
  const currentDate = new Date().toISOString().split('T')[0];
  const prompt = buildExtractionPrompt(pageText, links, currentDate);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content || '[]';

  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const events = JSON.parse(jsonStr) as ExtractedEvent[];

    // Validate and filter
    return events.filter((e) => {
      if (!e.title || !e.startDate) return false;
      // Basic ISO date validation
      if (!/^\d{4}-\d{2}-\d{2}/.test(e.startDate)) return false;
      return true;
    });
  } catch (error) {
    console.error('Failed to parse LLM response:', content);
    return [];
  }
}
```

**Step 3: Commit**

Run:
```bash
git add src/lib/scraper/prompt.ts src/lib/scraper/extract.ts
git commit -m "feat: add LLM event extraction module"
```

---

## Task 5: Scraper - Main Entry Point

**Files:**
- Create: `src/lib/scraper/index.ts`
- Create: `scripts/scrape.ts`

**Step 1: Create scraper orchestration**

Create `src/lib/scraper/index.ts`:
```typescript
import { randomUUID } from 'crypto';
import {
  getEnabledSources,
  updateSource,
  upsertEvent,
} from '../db';
import { Source } from '../types';
import { renderPage, closeBrowser } from './browser';
import { extractEvents } from './extract';

export async function scrapeSource(source: Source): Promise<{
  success: boolean;
  eventsFound: number;
  skipped: boolean;
  error?: string;
}> {
  console.log(`Scraping: ${source.name} (${source.url})`);

  try {
    // Render the page
    const { text, links, hash } = await renderPage(source.url);

    // Check if content changed
    if (hash === source.lastContentHash) {
      console.log(`  No changes detected, skipping LLM extraction`);
      await updateSource(source.id, {
        lastScrapedAt: new Date().toISOString(),
      });
      return { success: true, eventsFound: 0, skipped: true };
    }

    // Extract events via LLM
    const events = await extractEvents(text, links);
    console.log(`  Extracted ${events.length} events`);

    // Upsert events
    const scrapedAt = new Date().toISOString();
    for (const event of events) {
      upsertEvent({
        id: randomUUID(),
        sourceId: source.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate || null,
        location: event.location || null,
        description: event.description || null,
        url: event.url || null,
        rawData: JSON.stringify(event),
        scrapedAt,
      });
    }

    // Update source
    await updateSource(source.id, {
      lastScrapedAt: scrapedAt,
      lastContentHash: hash,
    });

    return { success: true, eventsFound: events.length, skipped: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  Error: ${errorMessage}`);
    return { success: false, eventsFound: 0, skipped: false, error: errorMessage };
  }
}

export async function scrapeAll(): Promise<void> {
  const sources = getEnabledSources();
  console.log(`Found ${sources.length} enabled sources`);

  const now = new Date();

  for (const source of sources) {
    // Check if due for scraping
    if (source.lastScrapedAt) {
      const lastScraped = new Date(source.lastScrapedAt);
      const hoursSince = (now.getTime() - lastScraped.getTime()) / (1000 * 60 * 60);
      if (hoursSince < source.scrapeIntervalHours) {
        console.log(`Skipping ${source.name}: scraped ${hoursSince.toFixed(1)}h ago`);
        continue;
      }
    }

    await scrapeSource(source);

    // Small delay between sources
    await new Promise((r) => setTimeout(r, 2000));
  }

  await closeBrowser();
  console.log('Done!');
}
```

**Step 2: Create CLI script**

Create `scripts/scrape.ts`:
```typescript
import 'dotenv/config';
import { scrapeAll } from '../src/lib/scraper';

scrapeAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

**Step 3: Install dotenv**

Run:
```bash
npm install dotenv
```

**Step 4: Add script to package.json**

In `package.json`, add to "scripts":
```json
"scrape": "tsx scripts/scrape.ts"
```

**Step 5: Commit**

Run:
```bash
git add src/lib/scraper/index.ts scripts/scrape.ts package.json package-lock.json
git commit -m "feat: add scraper orchestration and CLI script"
```

---

## Task 6: API Routes - Sources

**Files:**
- Create: `src/app/api/sources/route.ts`
- Create: `src/app/api/sources/[id]/route.ts`
- Create: `src/app/api/sources/[id]/scrape/route.ts`

**Step 1: Create sources list/create route**

Create `src/app/api/sources/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAllSources, createSource } from '@/lib/db';

export async function GET() {
  const sources = getAllSources();
  return NextResponse.json(sources);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.name || !body.url) {
    return NextResponse.json(
      { error: 'name and url are required' },
      { status: 400 }
    );
  }

  try {
    const source = createSource({
      id: randomUUID(),
      name: body.name,
      url: body.url,
      enabled: true,
      lastScrapedAt: null,
      lastContentHash: null,
      scrapeIntervalHours: body.scrapeIntervalHours || 24,
    });
    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return NextResponse.json(
        { error: 'A source with this URL already exists' },
        { status: 409 }
      );
    }
    throw error;
  }
}
```

**Step 2: Create source CRUD route**

Create `src/app/api/sources/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSourceById, updateSource, deleteSource } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const source = getSourceById(id);
  if (!source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }
  return NextResponse.json(source);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const source = updateSource(id, {
    name: body.name,
    url: body.url,
    enabled: body.enabled,
    scrapeIntervalHours: body.scrapeIntervalHours,
  });

  if (!source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  return NextResponse.json(source);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteSource(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
```

**Step 3: Create manual scrape trigger route**

Create `src/app/api/sources/[id]/scrape/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSourceById } from '@/lib/db';
import { scrapeSource } from '@/lib/scraper';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const source = getSourceById(id);

  if (!source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  const result = await scrapeSource(source);
  return NextResponse.json(result);
}
```

**Step 4: Commit**

Run:
```bash
git add src/app/api/sources/
git commit -m "feat: add sources API routes"
```

---

## Task 7: API Routes - Events

**Files:**
- Create: `src/app/api/events/route.ts`

**Step 1: Create events route**

Create `src/app/api/events/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getEvents } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const sourceIds = searchParams.get('sources')?.split(',').filter(Boolean);
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;
  const limit = searchParams.get('limit')
    ? parseInt(searchParams.get('limit')!, 10)
    : undefined;

  const events = getEvents({
    sourceIds,
    from,
    to,
    limit,
  });

  return NextResponse.json(events);
}
```

**Step 2: Commit**

Run:
```bash
git add src/app/api/events/
git commit -m "feat: add events API route"
```

---

## Task 8: Frontend - Event Components

**Files:**
- Create: `src/components/EventCard.tsx`
- Create: `src/components/EventList.tsx`

**Step 1: Create EventCard component**

Create `src/components/EventCard.tsx`:
```typescript
import { format } from 'date-fns';
import { Event, Source } from '@/lib/types';

interface EventCardProps {
  event: Event;
  source?: Source;
}

export function EventCard({ event, source }: EventCardProps) {
  const startDate = new Date(event.startDate);
  const dateStr = format(startDate, 'EEE, MMM d');
  const timeStr = event.startDate.includes('T00:00:00')
    ? null
    : format(startDate, 'h:mm a');

  return (
    <a
      href={event.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <h3 className="font-semibold text-gray-900 mb-1">{event.title}</h3>
      <div className="text-sm text-gray-600 space-y-0.5">
        <div className="flex items-center gap-2">
          {source && (
            <>
              <span className="text-gray-500">{source.name}</span>
              <span className="text-gray-300">·</span>
            </>
          )}
          <span>
            {dateStr}
            {timeStr && `, ${timeStr}`}
          </span>
        </div>
        {event.location && (
          <div className="text-gray-500">{event.location}</div>
        )}
      </div>
      {event.description && (
        <p className="mt-2 text-sm text-gray-600 line-clamp-2">
          {event.description}
        </p>
      )}
    </a>
  );
}
```

**Step 2: Create EventList component**

Create `src/components/EventList.tsx`:
```typescript
import { Event, Source } from '@/lib/types';
import { EventCard } from './EventCard';

interface EventListProps {
  events: Event[];
  sources: Source[];
}

export function EventList({ events, sources }: EventListProps) {
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No events found. Try adding some sources!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          source={sourceMap.get(event.sourceId)}
        />
      ))}
    </div>
  );
}
```

**Step 3: Commit**

Run:
```bash
git add src/components/
git commit -m "feat: add EventCard and EventList components"
```

---

## Task 9: Frontend - Filter Components

**Files:**
- Create: `src/components/SourceFilter.tsx`
- Create: `src/components/DateFilter.tsx`

**Step 1: Create SourceFilter component**

Create `src/components/SourceFilter.tsx`:
```typescript
'use client';

import { Source } from '@/lib/types';

interface SourceFilterProps {
  sources: Source[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function SourceFilter({ sources, selected, onChange }: SourceFilterProps) {
  const handleToggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const handleAll = () => {
    onChange([]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleAll}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          selected.length === 0
            ? 'bg-gray-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        All Sources
      </button>
      {sources.map((source) => (
        <button
          key={source.id}
          onClick={() => handleToggle(source.id)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selected.includes(source.id)
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {source.name}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Create DateFilter component**

Create `src/components/DateFilter.tsx`:
```typescript
'use client';

export type DateRange = 'today' | 'week' | 'month' | 'all';

interface DateFilterProps {
  selected: DateRange;
  onChange: (range: DateRange) => void;
}

const ranges: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All' },
];

export function DateFilter({ selected, onChange }: DateFilterProps) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            selected === range.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 3: Commit**

Run:
```bash
git add src/components/SourceFilter.tsx src/components/DateFilter.tsx
git commit -m "feat: add SourceFilter and DateFilter components"
```

---

## Task 10: Frontend - Main Page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/EventsPage.tsx`

**Step 1: Create client-side events page**

Create `src/app/EventsPage.tsx`:
```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Event, Source } from '@/lib/types';
import { EventList } from '@/components/EventList';
import { SourceFilter } from '@/components/SourceFilter';
import { DateFilter, DateRange } from '@/components/DateFilter';

interface EventsPageProps {
  initialEvents: Event[];
  initialSources: Source[];
}

function getDateRange(range: DateRange): { from: string; to: string } | null {
  const now = new Date();
  switch (range) {
    case 'today':
      return {
        from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        to: format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    case 'week':
      return {
        from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        to: format(endOfWeek(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    case 'month':
      return {
        from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        to: format(endOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    case 'all':
      return {
        from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        to: '',
      };
  }
}

export function EventsPage({ initialEvents, initialSources }: EventsPageProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [sources] = useState<Source[]>(initialSources);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSources.length > 0) {
        params.set('sources', selectedSources.join(','));
      }
      const range = getDateRange(dateRange);
      if (range) {
        if (range.from) params.set('from', range.from);
        if (range.to) params.set('to', range.to);
      }

      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, [selectedSources, dateRange]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">EventBobbin</h1>
            <a
              href="/sources"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Manage Sources
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <DateFilter selected={dateRange} onChange={setDateRange} />
            {loading && (
              <span className="text-sm text-gray-500">Loading...</span>
            )}
          </div>
          <SourceFilter
            sources={sources}
            selected={selectedSources}
            onChange={setSelectedSources}
          />
        </div>

        <EventList events={events} sources={sources} />
      </main>
    </div>
  );
}
```

**Step 2: Update main page**

Replace `src/app/page.tsx`:
```typescript
import { getEvents, getAllSources } from '@/lib/db';
import { EventsPage } from './EventsPage';
import { format, startOfDay, endOfMonth } from 'date-fns';

export const dynamic = 'force-dynamic';

export default function Home() {
  const sources = getAllSources();
  const now = new Date();
  const events = getEvents({
    from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
    to: format(endOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss"),
  });

  return <EventsPage initialEvents={events} initialSources={sources} />;
}
```

**Step 3: Commit**

Run:
```bash
git add src/app/page.tsx src/app/EventsPage.tsx
git commit -m "feat: add main events page with filters"
```

---

## Task 11: Frontend - Sources Management Page

**Files:**
- Create: `src/app/sources/page.tsx`
- Create: `src/app/sources/SourcesPage.tsx`

**Step 1: Create sources page client component**

Create `src/app/sources/SourcesPage.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { Source } from '@/lib/types';
import { format } from 'date-fns';

interface SourcesPageProps {
  initialSources: Source[];
}

export function SourcesPage({ initialSources }: SourcesPageProps) {
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [scraping, setScraping] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;

    setAdding(true);
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url }),
      });
      if (res.ok) {
        const source = await res.json();
        setSources([...sources, source]);
        setName('');
        setUrl('');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this source and all its events?')) return;

    const res = await fetch(`/api/sources/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSources(sources.filter((s) => s.id !== id));
    }
  };

  const handleToggle = async (source: Source) => {
    const res = await fetch(`/api/sources/${source.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !source.enabled }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSources(sources.map((s) => (s.id === source.id ? updated : s)));
    }
  };

  const handleScrape = async (id: string) => {
    setScraping(id);
    try {
      const res = await fetch(`/api/sources/${id}/scrape`, { method: 'POST' });
      const result = await res.json();
      alert(
        result.success
          ? `Found ${result.eventsFound} events${result.skipped ? ' (no changes)' : ''}`
          : `Error: ${result.error}`
      );
      // Refresh sources to get updated lastScrapedAt
      const sourcesRes = await fetch('/api/sources');
      setSources(await sourcesRes.json());
    } finally {
      setScraping(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Manage Sources</h1>
            <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back to Events
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleAdd} className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
          <h2 className="font-semibold mb-4">Add New Source</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Source name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <input
              type="url"
              placeholder="https://example.com/events"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-[2] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="submit"
              disabled={adding || !name || !url}
              className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {sources.map((source) => (
            <div
              key={source.id}
              className={`p-4 bg-white rounded-lg border border-gray-200 ${
                !source.enabled ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{source.name}</h3>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate block"
                  >
                    {source.url}
                  </a>
                  <div className="text-sm text-gray-500 mt-1">
                    {source.lastScrapedAt
                      ? `Last scraped: ${format(new Date(source.lastScrapedAt), 'MMM d, h:mm a')}`
                      : 'Never scraped'}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleScrape(source.id)}
                    disabled={scraping === source.id}
                    className="px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                  >
                    {scraping === source.id ? 'Scraping...' : 'Scrape Now'}
                  </button>
                  <button
                    onClick={() => handleToggle(source)}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      source.enabled
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {source.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => handleDelete(source.id)}
                    className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-md hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {sources.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No sources yet. Add one above!
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
```

**Step 2: Create sources page**

Create `src/app/sources/page.tsx`:
```typescript
import { getAllSources } from '@/lib/db';
import { SourcesPage } from './SourcesPage';

export const dynamic = 'force-dynamic';

export default function Sources() {
  const sources = getAllSources();
  return <SourcesPage initialSources={sources} />;
}
```

**Step 3: Commit**

Run:
```bash
git add src/app/sources/
git commit -m "feat: add sources management page"
```

---

## Task 12: Seed Initial Sources

**Files:**
- Create: `scripts/seed.ts`

**Step 1: Create seed script**

Create `scripts/seed.ts`:
```typescript
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { createSource, getAllSources } from '../src/lib/db';

const initialSources = [
  { name: 'Vangeline Theater', url: 'https://www.vangeline.com/calendar' },
  { name: 'Pulsion Institute', url: 'https://pulsioninstitute.com/events/' },
  { name: 'BPS Community', url: 'https://www.bps.community/events' },
  { name: 'School of Attention', url: 'https://www.schoolofattention.org/events' },
  { name: 'Light and Sound', url: 'https://www.lightandsound.design/' },
];

const existing = getAllSources();
const existingUrls = new Set(existing.map((s) => s.url));

let added = 0;
for (const source of initialSources) {
  if (!existingUrls.has(source.url)) {
    createSource({
      id: randomUUID(),
      name: source.name,
      url: source.url,
      enabled: true,
      lastScrapedAt: null,
      lastContentHash: null,
      scrapeIntervalHours: 24,
    });
    console.log(`Added: ${source.name}`);
    added++;
  } else {
    console.log(`Skipped (exists): ${source.name}`);
  }
}

console.log(`\nDone! Added ${added} sources.`);
```

**Step 2: Add seed script to package.json**

In `package.json`, add to "scripts":
```json
"seed": "tsx scripts/seed.ts"
```

**Step 3: Commit**

Run:
```bash
git add scripts/seed.ts package.json
git commit -m "feat: add seed script with initial sources"
```

---

## Task 13: Final Integration Test

**Step 1: Seed the database**

Run:
```bash
npm run seed
```

Expected: Sources added to database.

**Step 2: Start dev server**

Run:
```bash
npm run dev
```

**Step 3: Test the app**

Open http://localhost:3000:
- Should see "No events found" (not scraped yet)
- Click "Manage Sources" - should see 5 sources

**Step 4: Test scraping (requires OPENAI_API_KEY)**

Create `.env` with your OpenAI key:
```bash
echo "OPENAI_API_KEY=sk-your-key" > .env
```

On sources page, click "Scrape Now" on one source. Should see events appear.

**Step 5: Final commit**

Run:
```bash
git add -A
git commit -m "feat: complete EventBobbin v1 implementation"
```

---

## Summary

This implementation plan covers:
1. Project setup with Next.js, TypeScript, Tailwind
2. SQLite database with sources and events tables
3. Playwright browser rendering for JS-heavy sites
4. LLM extraction using GPT-4o-mini
5. API routes for sources and events
6. Frontend with filtering by source and date
7. Sources management page
8. Seed script with initial sources

**To deploy on VPS:**
1. Clone repo, `npm install`, `npm run build`
2. Set up `.env` with `OPENAI_API_KEY`
3. Run `npm run seed` to add initial sources
4. Start with PM2: `pm2 start npm --name eventbobbin -- start`
5. Add cron: `0 * * * * cd /path && npm run scrape >> /var/log/scrape.log 2>&1`
6. Set up Caddy for reverse proxy + SSL

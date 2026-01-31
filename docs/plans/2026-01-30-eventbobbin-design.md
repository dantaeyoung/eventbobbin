# EventBobbin Design

An event aggregation website that scrapes multiple sources and uses LLM extraction to consolidate events into a single filterable list.

## Problem

Multiple interesting event websites exist, but:
- They don't have RSS/iCal feeds
- Checking each one manually is tedious
- Events are scattered across different platforms

## Solution

A personal event aggregator that:
1. Renders JavaScript-heavy pages with a headless browser
2. Extracts events using an LLM (handles arbitrary page formats)
3. Stores events in a database
4. Displays them in a simple, filterable web UI

## Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Frontend + API | Next.js (App Router) | Single framework, TypeScript |
| Database | SQLite | Simple, no server, perfect for this scale |
| Scraper | Node + Playwright | Headless browser, same language as frontend |
| LLM | GPT-4o-mini (default) | Cheap, good at structured extraction |
| Deployment | VPS (single server) | Simple, co-located DB access, no network latency |
| Process manager | PM2 | Keeps Next.js running, easy restarts |
| Reverse proxy | Caddy | Auto-SSL with Let's Encrypt |

## Data Model

```typescript
interface Source {
  id: string
  name: string                  // "Vangeline Theater"
  url: string                   // "https://vangeline.com/calendar"
  enabled: boolean
  lastScrapedAt: Date | null
  lastContentHash: string | null // For change detection
  scrapeIntervalHours: number   // Default: 24
  createdAt: Date
}

interface Event {
  id: string
  sourceId: string
  title: string
  startDate: Date
  endDate: Date | null
  location: string | null
  description: string | null
  url: string | null            // Link to original event page
  rawData: string               // JSON - original LLM extraction for debugging
  createdAt: Date
  updatedAt: Date
  scrapedAt: Date
}

// Unique constraint: (sourceId, title, startDate)
// Used for upsert logic - same event updates rather than duplicates
```

## Scraping Pipeline

```
Cron (runs hourly)
  │
  ▼
For each source where lastScrapedAt + scrapeIntervalHours < now:
  │
  ├─▶ Playwright: load page, scroll to trigger lazy-loading, wait for network idle (with timeout)
  │
  ├─▶ Extract: visible text + all links on page
  │
  ├─▶ Hash extracted text, compare to lastContentHash
  │     │
  │     ├─▶ Same? Update lastScrapedAt, skip LLM, done
  │     │
  │     └─▶ Different? Continue ▼
  │
  ├─▶ LLM: send text + links, extract events as JSON array
  │
  ├─▶ SQLite: upsert events (match on sourceId + title + startDate)
  │
  └─▶ Update source: lastScrapedAt, lastContentHash
```

### LLM Prompt Design

The prompt will:
- Include current date for year disambiguation
- Provide a strict JSON schema for output
- Request empty array if no events found (no hallucination)
- Handle date ranges ("Feb 3-5" → two dates)
- Handle various time formats ("7pm", "19:00", "7:00 PM")

### Error Handling

- Log failures per source, continue to next source
- Store error in source record for visibility
- Retry logic: exponential backoff on consecutive failures

## Frontend

### Main View (/)

```
┌─────────────────────────────────────────────────────┐
│  EventBobbin                        [Manage Sources]│
├─────────────────────────────────────────────────────┤
│  Filters:  [All Sources ▼]  [This Week ▼]          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Butoh: Into the Depth - 5 week course       │   │
│  │ Vangeline Theater · Feb 3, 7:00 PM          │   │
│  │ 115 Wooster Street, New York             ↗  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Psychedelic Lacan                           │   │
│  │ Pulsion Institute · Feb 5, 5:15 PM       ↗  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- List view, sorted by date (soonest first)
- Filter by source (multi-select dropdown)
- Filter by date range (today, this week, this month, custom)
- Click event → opens original URL in new tab
- Past events hidden by default

### Sources View (/sources)

- List all sources with status (last scraped, error state)
- Add new source: name + URL
- Enable/disable sources
- Delete source (cascades to delete its events)
- Manual "scrape now" button per source

## API Routes

```
GET  /api/events?sources=id1,id2&from=2026-01-30&to=2026-02-28
POST /api/events/refresh          # Trigger manual scrape

GET  /api/sources
POST /api/sources                 # Create new source
PUT  /api/sources/:id             # Update source
DELETE /api/sources/:id           # Delete source + its events
POST /api/sources/:id/scrape      # Manual scrape trigger
```

## Project Structure

```
eventbobbin/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Main event list
│   │   ├── sources/
│   │   │   └── page.tsx          # Manage sources
│   │   └── api/
│   │       ├── events/
│   │       │   └── route.ts
│   │       └── sources/
│   │           ├── route.ts
│   │           └── [id]/
│   │               ├── route.ts
│   │               └── scrape/route.ts
│   │
│   ├── lib/
│   │   ├── db.ts                 # SQLite queries
│   │   ├── types.ts              # Shared types
│   │   └── scraper/
│   │       ├── index.ts          # Scraper entry point
│   │       ├── browser.ts        # Playwright rendering
│   │       ├── extract.ts        # LLM extraction
│   │       └── prompt.ts         # LLM prompt template
│   │
│   └── components/
│       ├── EventList.tsx
│       ├── EventCard.tsx
│       ├── SourceFilter.tsx
│       └── DateFilter.tsx
│
├── scripts/
│   └── scrape.ts                 # CLI entry: npx tsx scripts/scrape.ts
│
├── data/
│   └── events.db                 # SQLite database
│
├── package.json
├── tsconfig.json
├── next.config.js
├── .env.example                  # OPENAI_API_KEY=
└── .gitignore                    # data/*.db, .env
```

## Deployment (VPS)

### Initial Setup

```bash
# Install Node.js 20+
# Install PM2: npm install -g pm2

# Clone and build
git clone <repo> eventbobbin
cd eventbobbin
npm install
npm run build

# Set up environment
cp .env.example .env
# Edit .env with OPENAI_API_KEY

# Start Next.js
pm2 start npm --name eventbobbin -- start

# Set up cron for scraper
crontab -e
# Add: 0 * * * * cd /path/to/eventbobbin && /usr/bin/node scripts/scrape.js >> /var/log/eventbobbin-scrape.log 2>&1
```

### Caddy Config (reverse proxy + SSL)

```
events.yourdomain.com {
    reverse_proxy localhost:3000
}
```

### Updates

```bash
cd eventbobbin
git pull
npm install
npm run build
pm2 restart eventbobbin
```

## Initial Sources

| Name | URL |
|------|-----|
| Vangeline Theater | https://www.vangeline.com/calendar |
| Pulsion Institute | https://pulsioninstitute.com/events/ |
| BPS Community | https://www.bps.community/events |
| Joy List | https://joylist.beehiiv.com/ (note: URL changes weekly) |
| School of Attention | https://www.schoolofattention.org/events |
| Light and Sound | https://www.lightandsound.design/ |

## Not Building (YAGNI)

- User accounts / authentication
- Calendar view (list is sufficient for v1)
- Event favoriting / saving
- Full-text search
- Categories / tags (filter by source is enough)
- Email digests
- Mobile app
- Public API

## Future Considerations

If needed later:
- **Calendar view**: Add FullCalendar or similar
- **Better deduplication**: Fuzzy matching for events that appear on multiple sources
- **ICS feed**: Generate an iCal feed for subscribing in Google Calendar
- **Notifications**: Alert when new events from favorite sources appear

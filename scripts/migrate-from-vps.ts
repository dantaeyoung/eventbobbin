import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
const VPS_URL = 'http://eventbobbin.tools.dantaeyoung.com';

interface Source {
  id: string;
  name: string;
  url: string;
  enabled: number | boolean;
  lastScrapedAt: string | null;
  lastContentHash: string | null;
  scrapeIntervalHours: number;
  scrapeInstructions: string | null;
  scrapingStartedAt: string | null;
  tags: string | null;
  logoUrl: string | null;
  city: string | null;
  createdAt: string;
}

interface Event {
  id: string;
  sourceId: string;
  title: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  rawData: string;
  createdAt: string;
  updatedAt: string;
  scrapedAt: string;
}

async function main() {
  console.log('Fetching data from VPS...');

  // Fetch sources
  const sourcesRes = await fetch(`${VPS_URL}/api/sources`);
  const sources: Source[] = await sourcesRes.json();
  console.log(`Found ${sources.length} sources`);

  // Fetch events
  const eventsRes = await fetch(`${VPS_URL}/api/events`);
  const events: Event[] = await eventsRes.json();
  console.log(`Found ${events.length} events`);

  // Insert sources
  console.log('\nInserting sources...');
  for (const source of sources) {
    try {
      await sql`
        INSERT INTO sources (id, name, url, enabled, last_scraped_at, last_content_hash, scrape_interval_hours, scrape_instructions, scraping_started_at, tags, logo_url, city, created_at)
        VALUES (
          ${source.id},
          ${source.name},
          ${source.url},
          ${source.enabled === 1 || source.enabled === true},
          ${source.lastScrapedAt},
          ${source.lastContentHash},
          ${source.scrapeIntervalHours},
          ${source.scrapeInstructions},
          ${null},
          ${source.tags},
          ${source.logoUrl},
          ${source.city},
          ${source.createdAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          last_scraped_at = EXCLUDED.last_scraped_at,
          last_content_hash = EXCLUDED.last_content_hash,
          tags = EXCLUDED.tags,
          logo_url = EXCLUDED.logo_url,
          city = EXCLUDED.city
      `;
      console.log(`  ✓ ${source.name}`);
    } catch (error) {
      console.error(`  ✗ ${source.name}:`, error);
    }
  }

  // Insert events
  console.log('\nInserting events...');
  let eventCount = 0;
  let errorCount = 0;
  for (const event of events) {
    try {
      // Parse rawData if it's a string
      const rawDataJson = typeof event.rawData === 'string' ? event.rawData : JSON.stringify(event.rawData);

      await sql`
        INSERT INTO events (id, source_id, title, start_date, end_date, location, description, url, image_url, raw_data, created_at, updated_at, scraped_at)
        VALUES (
          ${event.id},
          ${event.sourceId},
          ${event.title},
          ${event.startDate},
          ${event.endDate},
          ${event.location},
          ${event.description},
          ${event.url},
          ${event.imageUrl},
          ${rawDataJson}::jsonb,
          ${event.createdAt},
          ${event.updatedAt},
          ${event.scrapedAt}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      eventCount++;
    } catch (error) {
      errorCount++;
      if (errorCount <= 5) {
        console.error(`  ✗ Event "${event.title}":`, error);
      }
    }
  }
  console.log(`  ✓ Inserted ${eventCount} events (${errorCount} errors)`);

  console.log('\nMigration complete!');
}

main().catch(console.error);

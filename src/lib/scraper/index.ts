import { randomUUID } from 'crypto';
import {
  getEnabledSources,
  updateSource,
  upsertEvent,
} from '../db';
import { Source } from '../types';
import { renderPage, closeBrowser } from './browser';
import { extractEvents } from './extract';

export async function scrapeSource(
  source: Source,
  options?: { force?: boolean }
): Promise<{
  success: boolean;
  eventsFound: number;
  skipped: boolean;
  error?: string;
}> {
  const force = options?.force ?? false;
  console.log(`Scraping: ${source.name} (${source.url})${force ? ' [FORCE]' : ''}`);

  try {
    // Render the page
    const { text, links, hash } = await renderPage(source.url);

    // Check if content changed (skip if force)
    if (!force && hash === source.lastContentHash) {
      console.log(`  No changes detected, skipping LLM extraction`);
      await updateSource(source.id, {
        lastScrapedAt: new Date().toISOString(),
      });
      return { success: true, eventsFound: 0, skipped: true };
    }

    // Extract events via LLM
    const events = await extractEvents(text, links, source.scrapeInstructions, source.id);
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
        imageUrl: event.imageUrl || null,
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

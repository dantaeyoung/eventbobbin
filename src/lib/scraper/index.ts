import { randomUUID } from 'crypto';
import {
  getEnabledSources,
  updateSource,
  upsertEvent,
} from '../db';
import { Source } from '../types';
import { renderPage, closeBrowser } from './browser';
import { extractEvents } from './extract';
import { detectLogo, cacheLogoImage } from './logo';
import { fetchEventPageDetails } from './eventImage';
import { isInstagramUrl, extractEventFromInstagram } from './instagram';

/**
 * Parse various date formats from JSON-LD schema into ISO string
 * Handles: ISO 8601, "2024-02-15T19:00", "2024-02-15", etc.
 */
function parseSchemaDate(dateStr: string): string | null {
  try {
    // Already valid ISO format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateStr)) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    // Date only format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const date = new Date(dateStr + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    // Try generic parsing as fallback
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

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
    // Handle Instagram posts specially
    if (isInstagramUrl(source.url)) {
      console.log('  Detected Instagram URL, using Instagram scraper');
      const instagramEvent = await extractEventFromInstagram(source.url);

      if (!instagramEvent) {
        return { success: false, eventsFound: 0, skipped: false, error: 'Failed to extract Instagram post' };
      }

      // Create event from Instagram data
      const eventId = randomUUID();
      const now = new Date().toISOString();
      await upsertEvent({
        id: eventId,
        sourceId: source.id,
        title: instagramEvent.title,
        description: instagramEvent.description,
        startDate: now, // Instagram posts don't have event dates, use current date
        endDate: null,
        url: source.url,
        imageUrl: instagramEvent.imageUrl || null,
        location: instagramEvent.location || null,
        rawData: instagramEvent.rawData,
        scrapedAt: now,
      });

      await updateSource(source.id, {
        lastScrapedAt: new Date().toISOString(),
      });

      console.log(`  Created event from Instagram post: ${instagramEvent.title.substring(0, 50)}...`);
      return { success: true, eventsFound: 1, skipped: false };
    }

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

    // Fetch additional details from event pages (og tags, JSON-LD schema, etc.)
    let detailsFetched = 0;
    let datesUpdated = 0;
    for (const event of events) {
      if (event.url) {
        const details = await fetchEventPageDetails(event.url);
        if (details) {
          detailsFetched++;
          // Fill in missing data from the event page
          if (details.imageUrl && !event.imageUrl) {
            event.imageUrl = details.imageUrl;
          }
          if (details.description && !event.description) {
            event.description = details.description;
          }
          if (details.venue && !event.location) {
            event.location = details.venue;
          }
          // Use schema dates - they're usually more accurate than LLM extraction
          if (details.startDate) {
            const schemaDate = parseSchemaDate(details.startDate);
            if (schemaDate) {
              event.startDate = schemaDate;
              datesUpdated++;
            }
          }
          if (details.endDate) {
            const schemaDate = parseSchemaDate(details.endDate);
            if (schemaDate) {
              event.endDate = schemaDate;
            }
          }
          // Store extra details in a separate field for the raw data
          (event as unknown as Record<string, unknown>).pageDetails = {
            price: details.price,
            fullText: details.fullText,
            schemaData: details.schemaData,
          };
        }
      }
    }
    if (detailsFetched > 0) {
      console.log(`  Fetched details from ${detailsFetched} event pages (${datesUpdated} dates from schema)`);
    }

    // Upsert events
    const scrapedAt = new Date().toISOString();
    for (const event of events) {
      await upsertEvent({
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

    // Detect and cache logo if not already set
    if (!source.logoUrl) {
      try {
        const detectedLogoUrl = await detectLogo(source.url, source.id);
        if (detectedLogoUrl) {
          // Try to cache the logo
          const cachedUrl = await cacheLogoImage(source.id, detectedLogoUrl);
          // Use cached URL if available, otherwise use the original
          const logoUrl = cachedUrl || detectedLogoUrl;
          await updateSource(source.id, { logoUrl });
          console.log(`  Set logo: ${logoUrl}`);
        }
      } catch (error) {
        console.error(`  Logo detection failed:`, error);
        // Don't fail the scrape if logo detection fails
      }
    }

    return { success: true, eventsFound: events.length, skipped: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  Error: ${errorMessage}`);
    return { success: false, eventsFound: 0, skipped: false, error: errorMessage };
  }
}

export async function scrapeAll(): Promise<void> {
  const sources = await getEnabledSources();
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

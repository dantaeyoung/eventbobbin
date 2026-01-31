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
      scrapeInstructions: null,
      scrapingStartedAt: null,
      tags: null,
      logoUrl: null,
    });
    console.log(`Added: ${source.name}`);
    added++;
  } else {
    console.log(`Skipped (exists): ${source.name}`);
  }
}

console.log(`\nDone! Added ${added} sources.`);

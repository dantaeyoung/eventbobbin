import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/lib/db');
  const { events } = await import('../src/lib/schema');
  const { fetchEventPageDetails } = await import('../src/lib/scraper/eventImage');
  const { eq } = await import('drizzle-orm');

  console.log('Updating event times from individual event pages...\n');

  // Get all events with URLs
  const allEvents = await db.select().from(events);
  const eventsWithUrls = allEvents.filter(e => e.url);

  console.log(`Found ${eventsWithUrls.length} events with URLs\n`);

  let updated = 0;
  let failed = 0;

  for (const event of eventsWithUrls) {
    if (!event.url) continue;

    process.stdout.write(`Processing: ${event.title.substring(0, 50)}... `);

    try {
      const details = await fetchEventPageDetails(event.url);

      if (details?.startDate) {
        const schemaDate = parseSchemaDate(details.startDate);
        if (schemaDate) {
          const schemaEndDate = details.endDate ? parseSchemaDate(details.endDate) : null;

          await db.update(events)
            .set({
              startDate: new Date(schemaDate),
              endDate: schemaEndDate ? new Date(schemaEndDate) : event.endDate,
            })
            .where(eq(events.id, event.id));

          console.log(`Updated (${schemaDate})`);
          updated++;
        } else {
          console.log('No valid date in schema');
        }
      } else {
        console.log('No schema data');
      }
    } catch (error) {
      console.log(`Error: ${error}`);
      failed++;
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone! Updated ${updated} events, ${failed} failed`);
  process.exit(0);
}

function parseSchemaDate(dateStr: string): string | null {
  try {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateStr)) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const date = new Date(dateStr + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

main().catch(console.error);

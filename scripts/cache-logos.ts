import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // Dynamic imports after dotenv is loaded
  const { db, updateSource } = await import('../src/lib/db');
  const { sources } = await import('../src/lib/schema');
  const { isNotNull } = await import('drizzle-orm');
  const { cacheLogoImage } = await import('../src/lib/scraper/logo');
  console.log('Caching logos for all sources with external logo URLs...\n');

  // Find sources that have a logoUrl but no logoData (not yet cached)
  // and where logoUrl doesn't start with /api (not already cached)
  const sourcesWithLogos = await db
    .select()
    .from(sources)
    .where(isNotNull(sources.logoUrl));

  const toCache = sourcesWithLogos.filter(
    (s: typeof sourcesWithLogos[number]) => s.logoUrl && !s.logoUrl.startsWith('/api') && !s.logoData
  );

  console.log(`Found ${toCache.length} logos to cache\n`);

  for (const source of toCache) {
    if (!source.logoUrl) continue;

    console.log(`Processing: ${source.name}`);
    const cachedUrl = await cacheLogoImage(source.id, source.logoUrl);

    if (cachedUrl) {
      await updateSource(source.id, { logoUrl: cachedUrl });
      console.log(`  ✓ Cached and updated URL\n`);
    } else {
      console.log(`  ✗ Failed to cache\n`);
    }

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('\nDone!');
  process.exit(0);
}

main().catch(console.error);

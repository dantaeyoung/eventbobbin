import { NextRequest, NextResponse } from 'next/server';
import { getSourceById, updateSource } from '@/lib/db';
import { scrapeSource } from '@/lib/scraper';

const SCRAPE_STALE_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const source = await getSourceById(id);

  if (!source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  // Check if already scraping (with stale timeout)
  if (source.scrapingStartedAt) {
    const startedAt = new Date(source.scrapingStartedAt).getTime();
    const elapsed = Date.now() - startedAt;
    if (elapsed < SCRAPE_STALE_MS) {
      return NextResponse.json({
        success: false,
        error: 'Already scraping',
        alreadyScraping: true,
        startedAt: source.scrapingStartedAt,
      });
    }
    // Stale scrape, clear it and proceed
  }

  // Mark as scraping
  await updateSource(id, { scrapingStartedAt: new Date().toISOString() });

  try {
    const force = request.nextUrl.searchParams.get('force') === 'true';
    const result = await scrapeSource(source, { force });
    return NextResponse.json(result);
  } finally {
    // Clear scraping state
    await updateSource(id, { scrapingStartedAt: null });
  }
}

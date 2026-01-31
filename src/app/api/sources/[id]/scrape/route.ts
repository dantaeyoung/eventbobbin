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

  const force = request.nextUrl.searchParams.get('force') === 'true';
  const result = await scrapeSource(source, { force });
  return NextResponse.json(result);
}

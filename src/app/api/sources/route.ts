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
      scrapeInstructions: body.scrapeInstructions || null,
      scrapingStartedAt: null,
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

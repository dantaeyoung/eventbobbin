import { NextRequest, NextResponse } from 'next/server';
import { getEvents } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const sourceIds = searchParams.get('sources')?.split(',').filter(Boolean);
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;
  const limit = searchParams.get('limit')
    ? parseInt(searchParams.get('limit')!, 10)
    : undefined;

  const events = getEvents({
    sourceIds,
    from,
    to,
    limit,
  });

  return NextResponse.json(events);
}

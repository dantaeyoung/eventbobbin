import { NextRequest, NextResponse } from 'next/server';
import { getEvents, getAllSources } from '@/lib/db';
import { format, startOfDay } from 'date-fns';

function formatIcsDate(date: string): string {
  return date.replace(/[-:]/g, '').split('.')[0];
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

export async function GET(request: NextRequest) {
  // Optional: filter by source IDs
  const sourcesParam = request.nextUrl.searchParams.get('sources');
  const sourceIds = sourcesParam ? sourcesParam.split(',') : undefined;

  // Get all future events
  const from = format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss");
  const events = getEvents({ sourceIds, from });
  const sources = getAllSources();
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventBobbin//EN',
    'X-WR-CALNAME:EventBobbin',
    'METHOD:PUBLISH',
    'CALSCALE:GREGORIAN',
  ];

  for (const event of events) {
    const source = sourceMap.get(event.sourceId);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@eventbobbin`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
      `DTSTART:${formatIcsDate(event.startDate)}`,
      `DTEND:${formatIcsDate(event.endDate || event.startDate)}`,
      `SUMMARY:${escapeIcsText(event.title)}`
    );

    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);

    // Build description with source name and original URL
    let description = '';
    if (source) description += `Source: ${source.name}\\n`;
    if (event.description) description += `${event.description}\\n`;
    if (event.url) description += `\\nMore info: ${event.url}`;
    if (description) lines.push(`DESCRIPTION:${escapeIcsText(description.trim())}`);

    if (event.url) lines.push(`URL:${event.url}`);

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  const icsContent = lines.join('\r\n');

  return new NextResponse(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

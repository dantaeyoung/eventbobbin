import { EventsPage } from './EventsPage';
import { format, startOfDay, endOfMonth } from 'date-fns';
import { Event, Source } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getData() {
  const baseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  const now = new Date();
  const from = format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss");
  const to = format(endOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss");

  const [eventsRes, sourcesRes] = await Promise.all([
    fetch(`${baseUrl}/api/events?from=${from}&to=${to}`, { cache: 'no-store' }),
    fetch(`${baseUrl}/api/sources`, { cache: 'no-store' }),
  ]);

  const events: Event[] = await eventsRes.json();
  const sources: Source[] = await sourcesRes.json();

  return { events, sources };
}

export default async function Home() {
  const { events, sources } = await getData();
  return <EventsPage initialEvents={events} initialSources={sources} />;
}

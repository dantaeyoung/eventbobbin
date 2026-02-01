import { EventsPage } from './EventsPage';
import { format, startOfDay, endOfMonth } from 'date-fns';
import { getEvents, getAllSources } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getData() {
  const now = new Date();
  const from = format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss");
  const to = format(endOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss");

  const [events, sources] = await Promise.all([
    getEvents({ from, to }),
    getAllSources(),
  ]);

  return { events, sources };
}

export default async function Home() {
  const { events, sources } = await getData();
  return <EventsPage initialEvents={events} initialSources={sources} />;
}

import { getEvents, getAllSources } from '@/lib/db';
import { EventsPage } from './EventsPage';
import { format, startOfDay, endOfMonth } from 'date-fns';

export const dynamic = 'force-dynamic';

export default function Home() {
  const sources = getAllSources();
  const now = new Date();
  const events = getEvents({
    from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
    to: format(endOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss"),
  });

  return <EventsPage initialEvents={events} initialSources={sources} />;
}

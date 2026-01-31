import { Event, Source } from '@/lib/types';
import { EventCard } from './EventCard';

interface EventListProps {
  events: Event[];
  sources: Source[];
  onDeleteEvent?: (event: Event) => void;
}

export function EventList({ events, sources, onDeleteEvent }: EventListProps) {
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No events found. Try adding some sources!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          source={sourceMap.get(event.sourceId)}
          onDelete={onDeleteEvent}
        />
      ))}
    </div>
  );
}

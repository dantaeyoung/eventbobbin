import { Event, Source } from '@/lib/types';
import { EventCard } from './EventCard';
import { format } from 'date-fns';
import { SquiggleSettings } from '@/lib/squiggleSettings';

interface EventListProps {
  events: Event[];
  sources: Source[];
  squiggleSettings?: SquiggleSettings;
  onEventClick?: (event: Event) => void;
  selectedEventId?: string | null;
}

// Group events by date
function groupEventsByDate(events: Event[]): Map<string, Event[]> {
  const groups = new Map<string, Event[]>();

  for (const event of events) {
    const dateKey = event.startDate.split('T')[0]; // YYYY-MM-DD
    const existing = groups.get(dateKey) || [];
    existing.push(event);
    groups.set(dateKey, existing);
  }

  return groups;
}

export function EventList({ events, sources, squiggleSettings, onEventClick, selectedEventId }: EventListProps) {
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No events found. Try adding some sources!
      </div>
    );
  }

  const groupedEvents = groupEventsByDate(events);
  const sortedDates = Array.from(groupedEvents.keys()).sort();

  return (
    <div className="space-y-6">
      {sortedDates.map((dateKey) => {
        const dateEvents = groupedEvents.get(dateKey) || [];
        const date = new Date(dateKey + 'T12:00:00'); // Noon to avoid timezone issues
        const dateLabel = format(date, 'EEEE, MMM d');

        return (
          <div key={dateKey}>
            {/* Date header */}
            <h2 className="text-[#2e32ff] font-bold text-[16px] mb-3">
              {dateLabel}
            </h2>

            {/* Events for this date */}
            <div className="bg-[#e8e8ff] rounded-lg p-4 space-y-4">
              {dateEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  source={sourceMap.get(event.sourceId)}
                  squiggleSettings={squiggleSettings}
                  onClick={onEventClick}
                  isSelected={selectedEventId === event.id}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

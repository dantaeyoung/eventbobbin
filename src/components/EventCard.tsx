import { format } from 'date-fns';
import { Event, Source } from '@/lib/types';

interface EventCardProps {
  event: Event;
  source?: Source;
}

export function EventCard({ event, source }: EventCardProps) {
  const startDate = new Date(event.startDate);
  const dateStr = format(startDate, 'EEE, MMM d');
  const timeStr = event.startDate.includes('T00:00:00')
    ? null
    : format(startDate, 'h:mm a');

  return (
    <a
      href={event.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden"
    >
      <div className="flex">
        {event.imageUrl && (
          <div className="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32">
            <img
              src={event.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide broken images
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="flex-1 p-4">
          <h3 className="font-semibold text-gray-900 mb-1">{event.title}</h3>
          <div className="text-sm text-gray-600 space-y-0.5">
            <div className="flex items-center gap-2">
              {source && (
                <>
                  <span className="text-gray-500">{source.name}</span>
                  <span className="text-gray-300">·</span>
                </>
              )}
              <span>
                {dateStr}
                {timeStr && `, ${timeStr}`}
              </span>
            </div>
            {event.location && (
              <div className="text-gray-500">{event.location}</div>
            )}
          </div>
          {event.description && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

import { format } from 'date-fns';
import { Event, Source } from '@/lib/types';

interface EventCardProps {
  event: Event;
  source?: Source;
  onDelete?: (event: Event) => void;
}

function formatDateForGoogle(date: string): string {
  // Convert to format: 20260201T190000
  return date.replace(/[-:]/g, '').split('.')[0];
}

function generateGoogleCalendarUrl(event: Event): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatDateForGoogle(event.startDate)}/${formatDateForGoogle(event.endDate || event.startDate)}`,
  });
  if (event.location) params.set('location', event.location);
  if (event.description) params.set('details', event.description);
  if (event.url) params.set('details', (event.description || '') + '\n\n' + event.url);
  return `https://calendar.google.com/calendar/render?${params}`;
}


export function EventCard({ event, source, onDelete }: EventCardProps) {
  const startDate = new Date(event.startDate);
  const dateStr = format(startDate, 'EEE, MMM d');
  const timeStr = event.startDate.includes('T00:00:00')
    ? null
    : format(startDate, 'h:mm a');

  return (
    <div className="group relative bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden">
      {/* Hover actions */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <a
          href={generateGoogleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 text-xs flex items-center justify-center"
          title="Add to Google Calendar"
        >
          G
        </a>
        <a
          href={`/api/events/${event.id}/ics`}
          onClick={(e) => e.stopPropagation()}
          className="w-6 h-6 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 text-xs flex items-center justify-center"
          title="Add to Calendar (.ics)"
        >
          📅
        </a>
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(event);
            }}
            className="w-6 h-6 bg-red-100 text-red-600 rounded-full hover:bg-red-200 text-xs flex items-center justify-center"
            title="Remove event"
          >
            ✕
          </button>
        )}
      </div>
      <a
        href={event.url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
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
    </div>
  );
}

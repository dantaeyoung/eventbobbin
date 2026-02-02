import { Event, Source } from '@/lib/types';
import { EventCard } from './EventCard';
import { format } from 'date-fns';
import { SquiggleSettings, positionToSquiggleParams, TagSquigglePosition } from '@/lib/squiggleSettings';

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateContainerSquiggle(
  width: number,
  height: number,
  seed: string,
  position: TagSquigglePosition = { x: 0.3, y: 0.3 }
): string {
  const { wiggleAmount, segmentLength, tension, chaos } = positionToSquiggleParams(position);

  let numericSeed = 0;
  for (let i = 0; i < seed.length; i++) {
    numericSeed += seed.charCodeAt(i);
  }

  let seedCounter = numericSeed;
  const frequency = 0.3;

  const getWiggle = (perimeterPos: number) => {
    seedCounter++;
    const periodicWiggle = Math.sin(perimeterPos * frequency + numericSeed * 0.1) * wiggleAmount;
    const randomWiggle = (seededRandom(seedCounter) - 0.5) * wiggleAmount * 2;
    return periodicWiggle * (1 - chaos) + randomWiggle * chaos;
  };

  const getSegmentStep = () => {
    if (chaos < 0.3) return segmentLength;
    const variation = (seededRandom(seedCounter++) - 0.5) * chaos * segmentLength * 0.5;
    return Math.max(10, segmentLength + variation);
  };

  const allPoints: { x: number; y: number }[] = [];
  const margin = 4;
  let perimeterPos = 0;

  for (let x = margin; x < width - margin; x += getSegmentStep()) {
    allPoints.push({ x, y: margin + getWiggle(perimeterPos) });
    perimeterPos += segmentLength;
  }
  for (let y = margin; y < height - margin; y += getSegmentStep()) {
    allPoints.push({ x: width - margin + getWiggle(perimeterPos), y });
    perimeterPos += segmentLength;
  }
  for (let x = width - margin; x > margin; x -= getSegmentStep()) {
    allPoints.push({ x, y: height - margin + getWiggle(perimeterPos) });
    perimeterPos += segmentLength;
  }
  for (let y = height - margin; y > margin; y -= getSegmentStep()) {
    allPoints.push({ x: margin + getWiggle(perimeterPos), y });
    perimeterPos += segmentLength;
  }

  if (allPoints.length < 3) return '';

  const pathParts: string[] = [`M ${allPoints[0].x} ${allPoints[0].y}`];
  for (let i = 0; i < allPoints.length; i++) {
    const p0 = allPoints[(i - 1 + allPoints.length) % allPoints.length];
    const p1 = allPoints[i];
    const p2 = allPoints[(i + 1) % allPoints.length];
    const p3 = allPoints[(i + 2) % allPoints.length];
    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;
    pathParts.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }
  pathParts.push('Z');
  return pathParts.join(' ');
}

interface EventListProps {
  events: Event[];
  sources: Source[];
  squiggleSettings?: SquiggleSettings;
  onEventClick?: (event: Event) => void;
  selectedEventId?: string | null;
}

// Group events by local date
function groupEventsByDate(events: Event[]): Map<string, Event[]> {
  const groups = new Map<string, Event[]>();

  for (const event of events) {
    // Use local date, not UTC date from ISO string
    const localDate = new Date(event.startDate);
    const dateKey = format(localDate, 'yyyy-MM-dd');
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
      <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
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

        const squigglePath = generateContainerSquiggle(600, 400, dateKey, { x: 0.1, y: 0.15 });

        return (
          <div key={dateKey}>
            {/* Date header */}
            <h2 className="font-bold text-[16px] mb-3" style={{ color: 'var(--color-accent)' }}>
              {dateLabel}
            </h2>

            {/* Events for this date */}
            <div className="relative">
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
                viewBox="0 0 600 400"
              >
                <path
                  d={squigglePath}
                  fill="var(--color-accent-light)"
                  stroke="var(--color-accent-stroke)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="relative p-4 space-y-4">
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
          </div>
        );
      })}
    </div>
  );
}

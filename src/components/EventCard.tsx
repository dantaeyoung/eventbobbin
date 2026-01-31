'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { Event, Source } from '@/lib/types';
import { getTagColor } from '@/lib/tagColors';
import {
  positionToSquiggleParams,
  TagSquigglePosition,
  SquiggleSettings,
} from '@/lib/squiggleSettings';

interface EventCardProps {
  event: Event;
  source?: Source;
  onDelete?: (event: Event) => void;
  squiggleSettings?: SquiggleSettings;
}

function formatDateForGoogle(date: string): string {
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

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateWigglyPath(
  width: number,
  height: number,
  seed: string,
  squigglePosition: TagSquigglePosition
): string {
  const { wiggleAmount, segmentLength, tension, chaos } = positionToSquiggleParams(squigglePosition);

  if (squigglePosition.x < 0.1 && squigglePosition.y < 0.1) {
    const r = 8;
    const m = 8;
    return `M ${m + r} ${m} L ${width - m - r} ${m} Q ${width - m} ${m} ${width - m} ${m + r} L ${width - m} ${height - m - r} Q ${width - m} ${height - m} ${width - m - r} ${height - m} L ${m + r} ${height - m} Q ${m} ${height - m} ${m} ${height - m - r} L ${m} ${m + r} Q ${m} ${m} ${m + r} ${m} Z`;
  }

  let numericSeed = 0;
  for (let i = 0; i < seed.length; i++) {
    numericSeed += seed.charCodeAt(i);
  }

  let seedCounter = numericSeed;

  const wiggle = () => {
    seedCounter++;
    const baseWiggle = (seededRandom(seedCounter) - 0.5) * wiggleAmount * 2;
    const chaosMultiplier = 1 + (seededRandom(seedCounter + 1000) - 0.5) * chaos * 1.5;
    return baseWiggle * chaosMultiplier;
  };

  const allPoints: { x: number; y: number }[] = [];
  const margin = 8;

  const getSegmentStep = () => {
    if (chaos < 0.2) return segmentLength;
    const variation = (seededRandom(seedCounter++) - 0.5) * chaos * segmentLength * 0.6;
    return Math.max(8, segmentLength + variation);
  };

  for (let x = margin; x < width - margin; x += getSegmentStep()) {
    allPoints.push({ x: x + wiggle(), y: margin + wiggle() });
  }
  for (let y = margin; y < height - margin; y += getSegmentStep()) {
    allPoints.push({ x: width - margin + wiggle(), y: y + wiggle() });
  }
  for (let x = width - margin; x > margin; x -= getSegmentStep()) {
    allPoints.push({ x: x + wiggle(), y: height - margin + wiggle() });
  }
  for (let y = height - margin; y > margin; y -= getSegmentStep()) {
    allPoints.push({ x: margin + wiggle(), y: y + wiggle() });
  }

  if (allPoints.length < 3) return '';

  const pathParts: string[] = [];
  pathParts.push(`M ${allPoints[0].x} ${allPoints[0].y}`);

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

export function EventCard({ event, source, onDelete, squiggleSettings = {} }: EventCardProps) {
  const startDate = new Date(event.startDate);
  const hasTime = !event.startDate.includes('T00:00:00');
  const timeStr = hasTime ? format(startDate, 'h:mma').toLowerCase() : null;

  const tags = source?.tags
    ? source.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  // Calculate squiggle position from passed settings
  const squigglePosition = useMemo(() => {
    if (tags.length === 0) return { x: 0, y: 0 };

    let totalX = 0;
    let totalY = 0;
    let count = 0;

    for (const tag of tags) {
      const pos = squiggleSettings[tag];
      if (pos) {
        totalX += pos.x;
        totalY += pos.y;
        count++;
      }
    }

    if (count === 0) return { x: 0, y: 0 };
    return { x: totalX / count, y: totalY / count };
  }, [tags, squiggleSettings]);

  const wigglyPath = generateWigglyPath(380, 130, event.id, squigglePosition);

  return (
    <div className="group relative">
      {/* Hover actions */}
      <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
        <div className="flex items-center gap-2">
          {/* Source name - vertical, rotated */}
          {source && (
            <div className="flex-shrink-0 flex items-center justify-center w-[24px] h-[100px]">
              <span
                className="font-bold text-[#2e32ff] text-[14px] whitespace-nowrap"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                }}
              >
                {source.name}
              </span>
            </div>
          )}

          {/* Squiggle box with content */}
          <div className="relative w-[380px] min-h-[130px] flex-shrink-0">
            {/* Wiggly border SVG */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
              viewBox="0 0 380 130"
            >
              <path
                d={wigglyPath}
                fill="white"
                stroke="#d3d3d3"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* Time badge - upper right, rotated */}
            {timeStr && (
              <div
                className="absolute -top-2 -right-2 bg-[#2e32ff] text-white text-[12px] font-bold px-2 py-1 rounded-md z-10"
                style={{ transform: 'rotate(15deg)' }}
              >
                {timeStr}
              </div>
            )}

            <div className="relative p-5">
              {/* Event title */}
              <h3 className="font-bold text-black text-[14px] mb-2 pr-12">
                {event.title}
              </h3>

              {/* Description */}
              {event.description && (
                <p className="text-[12px] text-black font-normal mb-1 line-clamp-2">
                  {event.description}
                </p>
              )}

              {/* Location */}
              {event.location && (
                <p className="text-[12px] text-black font-normal">
                  {event.location}
                </p>
              )}
            </div>

            {/* Tags - bottom right corner, rotated */}
            {tags.length > 0 && (
              <div className="absolute -bottom-2 -right-2 flex gap-1 z-10">
                {tags.slice(0, 3).map((tag, i) => {
                  const colors = getTagColor(tag);
                  return (
                    <div
                      key={i}
                      className="px-2 py-1 rounded-md text-[10px] font-medium"
                      style={{
                        backgroundColor: colors.bg,
                        color: colors.text,
                        transform: `rotate(${10 + i * 5}deg)`,
                      }}
                    >
                      {tag}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </a>
    </div>
  );
}

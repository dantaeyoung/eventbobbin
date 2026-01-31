'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Event, Source } from '@/lib/types';
import { getTagColor } from '@/lib/tagColors';
import {
  getAverageSquigglePosition,
  positionToSquiggleParams,
  TagSquigglePosition,
} from '@/lib/squiggleSettings';

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

// Generate a seeded random number
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate wiggly path for the border using smooth curves
function generateWigglyPath(
  width: number,
  height: number,
  seed: string,
  squigglePosition: TagSquigglePosition
): string {
  const { wiggleAmount, segmentLength, tension, chaos } = positionToSquiggleParams(squigglePosition);

  // If very ordered and rigid (bottom-left), return a simple rounded rectangle
  if (squigglePosition.x < 0.1 && squigglePosition.y < 0.1) {
    const r = 8;
    const m = 8;
    return `M ${m + r} ${m} L ${width - m - r} ${m} Q ${width - m} ${m} ${width - m} ${m + r} L ${width - m} ${height - m - r} Q ${width - m} ${height - m} ${width - m - r} ${height - m} L ${m + r} ${height - m} Q ${m} ${height - m} ${m} ${height - m - r} L ${m} ${m + r} Q ${m} ${m} ${m + r} ${m} Z`;
  }

  // Create a numeric seed from the string
  let numericSeed = 0;
  for (let i = 0; i < seed.length; i++) {
    numericSeed += seed.charCodeAt(i);
  }

  let seedCounter = numericSeed;

  // Wiggle function that incorporates chaos for irregularity
  const wiggle = () => {
    seedCounter++;
    const baseWiggle = (seededRandom(seedCounter) - 0.5) * wiggleAmount * 2;
    const chaosMultiplier = 1 + (seededRandom(seedCounter + 1000) - 0.5) * chaos * 1.5;
    return baseWiggle * chaosMultiplier;
  };

  // Generate all points around the rectangle
  const allPoints: { x: number; y: number }[] = [];
  const margin = 8;

  // Chaos also affects segment spacing
  const getSegmentStep = () => {
    if (chaos < 0.2) return segmentLength;
    const variation = (seededRandom(seedCounter++) - 0.5) * chaos * segmentLength * 0.6;
    return Math.max(8, segmentLength + variation);
  };

  // Top edge (left to right)
  for (let x = margin; x < width - margin; x += getSegmentStep()) {
    allPoints.push({ x: x + wiggle(), y: margin + wiggle() });
  }
  // Right edge (top to bottom)
  for (let y = margin; y < height - margin; y += getSegmentStep()) {
    allPoints.push({ x: width - margin + wiggle(), y: y + wiggle() });
  }
  // Bottom edge (right to left)
  for (let x = width - margin; x > margin; x -= getSegmentStep()) {
    allPoints.push({ x: x + wiggle(), y: height - margin + wiggle() });
  }
  // Left edge (bottom to top)
  for (let y = height - margin; y > margin; y -= getSegmentStep()) {
    allPoints.push({ x: margin + wiggle(), y: y + wiggle() });
  }

  if (allPoints.length < 3) return '';

  // Create smooth curve using Catmull-Rom to Bezier conversion
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

export function EventCard({ event, source, onDelete }: EventCardProps) {
  const [squigglePosition, setSquigglePosition] = useState<TagSquigglePosition>({ x: 0, y: 0 });

  const startDate = new Date(event.startDate);
  const dateStr = format(startDate, 'EEE, MMM d');
  const timeStr = event.startDate.includes('T00:00:00')
    ? null
    : format(startDate, 'h:mm a');

  const tags = source?.tags
    ? source.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  // Load squiggle settings on mount
  useEffect(() => {
    if (tags.length > 0) {
      const pos = getAverageSquigglePosition(tags);
      setSquigglePosition(pos);
    }
  }, [source?.tags]);

  // Use event ID as seed for consistent wiggly border
  const wigglyPath = generateWigglyPath(340, 130, event.id, squigglePosition);

  return (
    <div className="group relative">
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
        <div className="flex items-center gap-2">
          {/* Date/Time - far left */}
          <div className="w-[70px] flex-shrink-0 text-right text-[#2e32ff] text-[12px] font-bold whitespace-nowrap">
            <div>{dateStr}</div>
            {timeStr && <div>{timeStr}</div>}
          </div>

          {/* Source name - vertical, rotated */}
          {source && (
            <div className="flex-shrink-0 flex items-center justify-center w-[20px] h-[90px]">
              <span
                className="font-bold text-[#2e32ff] text-[16px] whitespace-nowrap"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                }}
              >
                {source.name}
              </span>
            </div>
          )}

          {/* Squiggle box with content - fixed width */}
          <div className="relative w-[340px] min-h-[130px] bg-white flex-shrink-0">
            {/* Wiggly border SVG */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
              viewBox="0 0 340 130"
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

            <div className="relative p-5">
              {/* Event title */}
              <h3 className="font-bold text-black text-[14px] mb-2">
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
          </div>

          {/* Vertical tags on the right - outside the box, stacked */}
          {tags.length > 0 && (
            <div className="flex flex-col gap-1 self-stretch justify-center flex-shrink-0">
              {tags.slice(0, 4).map((tag, i) => {
                const colors = getTagColor(tag);
                return (
                  <div
                    key={i}
                    className="w-[24px] flex-1 min-h-[28px] flex items-center justify-center rounded-[7px]"
                    style={{ backgroundColor: colors.bg }}
                  >
                    <span
                      className="text-[10px] font-medium whitespace-nowrap"
                      style={{
                        color: colors.text,
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                      }}
                    >
                      {tag}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </a>
    </div>
  );
}

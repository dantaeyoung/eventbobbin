'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { Event, Source } from '@/lib/types';
import { getTagColor } from '@/lib/tagColors';
import { Tooltip } from '@/components/Tooltip';
import {
  positionToSquiggleParams,
  TagSquigglePosition,
  SquiggleSettings,
} from '@/lib/squiggleSettings';

interface EventCardProps {
  event: Event;
  source?: Source;
  squiggleSettings?: SquiggleSettings;
  onClick?: (event: Event) => void;
  isSelected?: boolean;
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

// Generate a pastel color from a string
function stringToPastelColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Generate HSL with high lightness for pastel
  const h = Math.abs(hash % 360);
  const s = 50 + (Math.abs((hash >> 8) % 30)); // 50-80% saturation
  const l = 80 + (Math.abs((hash >> 16) % 10)); // 80-90% lightness
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// Calculate font size to fit text in a box
function getFontSizeForBox(text: string, boxSize: number): number {
  const len = text.length;
  // Approximate: shorter text = bigger font
  if (len <= 3) return Math.floor(boxSize * 0.35);
  if (len <= 6) return Math.floor(boxSize * 0.25);
  if (len <= 10) return Math.floor(boxSize * 0.18);
  if (len <= 15) return Math.floor(boxSize * 0.14);
  if (len <= 20) return Math.floor(boxSize * 0.11);
  return Math.floor(boxSize * 0.09);
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
  const frequency = 0.4; // Waves per unit distance

  // Get wiggle amount at a specific position along perimeter
  // For order: uses sine wave. For chaos: uses random.
  const getWiggle = (perimeterPos: number) => {
    seedCounter++;

    // Periodic component: sine wave based on position along perimeter
    const periodicWiggle = Math.sin(perimeterPos * frequency + numericSeed * 0.1) * wiggleAmount;

    // Random component: seeded random
    const randomWiggle = (seededRandom(seedCounter) - 0.5) * wiggleAmount * 2;

    // Blend based on chaos: 0 = pure sine, 1 = pure random
    return periodicWiggle * (1 - chaos) + randomWiggle * chaos;
  };

  const allPoints: { x: number; y: number }[] = [];
  const margin = 8;

  const getSegmentStep = () => {
    if (chaos < 0.3) return segmentLength;
    const variation = (seededRandom(seedCounter++) - 0.5) * chaos * segmentLength * 0.5;
    return Math.max(8, segmentLength + variation);
  };

  let perimeterPos = 0;

  // Top edge: wiggle perpendicular (y direction only)
  for (let x = margin; x < width - margin; x += getSegmentStep()) {
    const w = getWiggle(perimeterPos);
    allPoints.push({ x: x, y: margin + w });
    perimeterPos += segmentLength;
  }
  // Right edge: wiggle perpendicular (x direction only)
  for (let y = margin; y < height - margin; y += getSegmentStep()) {
    const w = getWiggle(perimeterPos);
    allPoints.push({ x: width - margin + w, y: y });
    perimeterPos += segmentLength;
  }
  // Bottom edge: wiggle perpendicular (y direction only)
  for (let x = width - margin; x > margin; x -= getSegmentStep()) {
    const w = getWiggle(perimeterPos);
    allPoints.push({ x: x, y: height - margin + w });
    perimeterPos += segmentLength;
  }
  // Left edge: wiggle perpendicular (x direction only)
  for (let y = height - margin; y > margin; y -= getSegmentStep()) {
    const w = getWiggle(perimeterPos);
    allPoints.push({ x: margin + w, y: y });
    perimeterPos += segmentLength;
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

export function EventCard({ event, source, squiggleSettings = {}, onClick, isSelected = false }: EventCardProps) {
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

  // Add salt to seed when selected to shift the squiggle
  const wigglyPath = generateWigglyPath(380, 125, isSelected ? event.id + '_selected' : event.id, squigglePosition);

  return (
    <div className="group relative">
      <div
        onClick={() => onClick?.(event)}
        className="block cursor-pointer"
      >
        <div className="flex items-start gap-2 md:gap-3">
          {/* Left column: Time + Source logo + Source name (hidden on mobile) */}
          <div className="hidden md:flex flex-col items-end flex-shrink-0 w-[85px]">
            {/* Time - always takes space for consistent layout */}
            <p className="font-bold text-[12px] mb-1 h-[16px]" style={{ color: 'var(--color-accent)' }}>
              {timeStr ? (
                <Tooltip text="This time was scraped automatically - double check the source to be sure!">
                  {timeStr}<span className="ml-0.5">?</span>
                </Tooltip>
              ) : ''}
            </p>

            {/* Source logo */}
            {source && (
              <div className="w-[75px] h-[75px] overflow-hidden">
                {source.logoUrl ? (
                  <img
                    src={source.logoUrl}
                    alt=""
                    className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center overflow-hidden p-1"
                    style={{ backgroundColor: stringToPastelColor(source.name) }}
                  >
                    <span
                      className="text-gray-700 text-center font-bold leading-tight break-words"
                      style={{ fontSize: `${getFontSizeForBox(source.name, 75)}px` }}
                    >
                      {source.name}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Source name - only show if there's a logo (otherwise it's in the square) */}
            {source && source.logoUrl && (
              <p className="font-medium text-[#232223] text-[8px] text-right mt-1 leading-tight w-full">
                {source.name}
              </p>
            )}
          </div>

          {/* Squiggle box with content */}
          <div className="relative w-full md:w-[380px] flex-shrink-0">
            {/* Wiggly border SVG */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
              viewBox="0 0 380 125"
            >
              <path
                d={wigglyPath}
                fill={isSelected ? 'var(--color-accent-light)' : 'var(--color-card-bg)'}
                stroke={isSelected ? 'var(--color-accent-stroke)' : 'var(--color-card-stroke)'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: 'd 0.3s ease-in-out, fill 0.3s ease-in-out, stroke 0.3s ease-in-out'
                }}
              />
            </svg>

            <div className="relative p-4 md:p-6 flex gap-2 md:gap-3 items-center min-h-[110px] md:min-h-[125px]">
              <div className="flex-1 min-w-0">
                {/* Event title */}
                <h3 className="font-bold text-[14px] mb-2" style={{ color: 'var(--color-text)' }}>
                  {event.title}
                </h3>

                {/* Description */}
                {event.description && (
                  <p className="text-[12px] font-normal mb-1 line-clamp-2" style={{ color: 'var(--color-text)' }}>
                    {event.description}
                  </p>
                )}

                {/* Location */}
                {event.location && (
                  <p className="text-[12px] font-normal" style={{ color: 'var(--color-text)' }}>
                    {event.location}
                  </p>
                )}

                {/* Source name and time on mobile */}
                <div className="md:hidden flex items-center gap-2 mt-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {timeStr && (
                    <Tooltip text="This time was scraped automatically - double check the source to be sure!">
                      <span className="font-bold" style={{ color: 'var(--color-accent)' }}>
                        {timeStr}<span className="ml-0.5">?</span>
                      </span>
                    </Tooltip>
                  )}
                  {source && <span>{source.name}</span>}
                </div>
              </div>

              {/* Event image thumbnail */}
              {event.imageUrl && (
                <div className="flex-shrink-0 w-[70px] h-[70px] md:w-[100px] md:h-[100px] border-3 border-[#e8e4dc] overflow-hidden">
                  <img
                    src={event.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
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
      </div>
    </div>
  );
}

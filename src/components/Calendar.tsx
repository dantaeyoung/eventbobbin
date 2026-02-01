'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';

interface CalendarProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  eventDates: Set<string>; // ISO date strings (YYYY-MM-DD)
}

// Generate points around a rectangle with wiggle
function generateSquigglePoints(
  width: number,
  height: number,
  seed: number,
  wiggleAmount: number = 8,
  segmentLength: number = 20
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const margin = 8;

  // Seeded random
  const random = (i: number) => {
    const x = Math.sin(seed + i * 127.1) * 10000;
    return (x - Math.floor(x)) - 0.5;
  };

  let idx = 0;

  // Top edge
  for (let x = margin; x < width - margin; x += segmentLength) {
    points.push({
      x: x + random(idx++) * wiggleAmount,
      y: margin + random(idx++) * wiggleAmount,
    });
  }
  // Right edge
  for (let y = margin; y < height - margin; y += segmentLength) {
    points.push({
      x: width - margin + random(idx++) * wiggleAmount,
      y: y + random(idx++) * wiggleAmount,
    });
  }
  // Bottom edge
  for (let x = width - margin; x > margin; x -= segmentLength) {
    points.push({
      x: x + random(idx++) * wiggleAmount,
      y: height - margin + random(idx++) * wiggleAmount,
    });
  }
  // Left edge
  for (let y = height - margin; y > margin; y -= segmentLength) {
    points.push({
      x: margin + random(idx++) * wiggleAmount,
      y: y + random(idx++) * wiggleAmount,
    });
  }

  return points;
}

// Convert points to smooth SVG path using Catmull-Rom
function pointsToPath(points: { x: number; y: number }[], tension: number = 6): string {
  if (points.length < 3) return '';

  const pathParts: string[] = [];
  pathParts.push(`M ${points[0].x} ${points[0].y}`);

  for (let i = 0; i < points.length; i++) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const p3 = points[(i + 2) % points.length];

    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;

    pathParts.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  pathParts.push('Z');
  return pathParts.join(' ');
}

// Interpolate between two point arrays
function interpolatePoints(
  from: { x: number; y: number }[],
  to: { x: number; y: number }[],
  t: number
): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  const len = Math.min(from.length, to.length);

  for (let i = 0; i < len; i++) {
    result.push({
      x: from[i].x + (to[i].x - from[i].x) * t,
      y: from[i].y + (to[i].y - from[i].y) * t,
    });
  }

  return result;
}

// Easing function for smooth transitions
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function Calendar({ selectedDate, onSelectDate, eventDates }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [path, setPath] = useState('');

  const animationRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const basePointsRef = useRef<{ x: number; y: number }[]>([]);
  const displayPointsRef = useRef<{ x: number; y: number }[]>([]);
  const targetPointsRef = useRef<{ x: number; y: number }[]>([]);
  const transitionStartRef = useRef<number>(0);
  const transitionDurationRef = useRef<number>(0);
  const transitionFromRef = useRef<{ x: number; y: number }[]>([]);
  const baseSeedRef = useRef<number>(Date.now());
  const lastClickTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());

  const width = 240;
  const height = 280;

  // Initialize points
  useEffect(() => {
    const initialPoints = generateSquigglePoints(width, height, baseSeedRef.current);
    basePointsRef.current = initialPoints;
    displayPointsRef.current = initialPoints.map(p => ({ ...p }));
    targetPointsRef.current = initialPoints.map(p => ({ ...p }));
    setPath(pointsToPath(initialPoints));
    startTimeRef.current = performance.now();
  }, []);

  // Animation loop - continuous undulation using time-based offsets
  const animate = useCallback(() => {
    const now = performance.now();
    const basePoints = basePointsRef.current;

    if (basePoints.length === 0) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    // Check if we're in a fast transition (after a click)
    const timeSinceTransitionStart = now - transitionStartRef.current;
    const transitionDuration = transitionDurationRef.current;

    if (transitionDuration > 0 && timeSinceTransitionStart < transitionDuration) {
      // Fast transition in progress
      const t = easeInOutCubic(timeSinceTransitionStart / transitionDuration);
      const interpolated = interpolatePoints(
        transitionFromRef.current,
        targetPointsRef.current,
        t
      );
      displayPointsRef.current = interpolated;
      setPath(pointsToPath(interpolated));
    } else {
      // Transition finished - update base points
      if (transitionDuration > 0) {
        basePointsRef.current = targetPointsRef.current.map(p => ({ ...p }));
        transitionDurationRef.current = 0;
      }

      // Slow continuous undulation using sinusoidal time-based offsets
      const time = (now - startTimeRef.current) * 0.001; // Convert to seconds
      const undulatedPoints = basePointsRef.current.map((point, i) => {
        // Each point gets unique phase offsets based on its index
        const phaseX = i * 0.7;
        const phaseY = i * 0.9 + 100;

        // Multiple overlapping sine waves for organic movement
        const offsetX =
          Math.sin(time * 0.5 + phaseX) * 2 +
          Math.sin(time * 0.3 + phaseX * 1.3) * 1.5 +
          Math.sin(time * 0.7 + phaseX * 0.7) * 1;
        const offsetY =
          Math.sin(time * 0.4 + phaseY) * 2 +
          Math.sin(time * 0.25 + phaseY * 1.2) * 1.5 +
          Math.sin(time * 0.6 + phaseY * 0.8) * 1;

        return {
          x: point.x + offsetX,
          y: point.y + offsetY,
        };
      });

      displayPointsRef.current = undulatedPoints;
      setPath(pointsToPath(undulatedPoints));
    }

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  // Start animation
  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  // Trigger fast transition on date change
  useEffect(() => {
    const now = performance.now();
    // Avoid triggering on initial mount
    if (lastClickTimeRef.current > 0) {
      // Save current display state as transition start
      transitionFromRef.current = displayPointsRef.current.map(p => ({ ...p }));

      // Generate a new random target
      baseSeedRef.current = Date.now() + Math.random() * 1000;
      targetPointsRef.current = generateSquigglePoints(
        width,
        height,
        baseSeedRef.current,
        10, // More wiggle on transitions
        20
      );
      transitionStartRef.current = now;
      transitionDurationRef.current = 300; // 300ms fast transition
    }
    lastClickTimeRef.current = now;
  }, [selectedDate]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  // Build array of weeks
  const weeks: Date[][] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const handleDateClick = (date: Date) => {
    if (selectedDate && isSameDay(date, selectedDate)) {
      onSelectDate(null); // Deselect if clicking same date
    } else {
      onSelectDate(date);
    }
  };

  return (
    <div ref={containerRef} className="relative" style={{ width, height }}>
      {/* Animated squiggly border */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${width} ${height}`}
      >
        <path
          d={path}
          fill="white"
          stroke="#d3d3d3"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Calendar content */}
      <div className="relative p-5 h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1 hover:bg-gray-100 rounded"
          >
            ←
          </button>
          <h3 className="font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1 hover:bg-gray-100 rounded"
          >
            →
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <div key={d} className="text-center text-xs text-gray-500 font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {weeks.flat().map((date, i) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const hasEvents = eventDates.has(dateKey);
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isTodayDate = isToday(date);

            return (
              <button
                key={i}
                onClick={() => handleDateClick(date)}
                className={`
                  aspect-square flex items-center justify-center text-sm rounded-full
                  ${!isCurrentMonth ? 'text-gray-300' : ''}
                  ${isTodayDate ? 'font-bold' : ''}
                  ${isSelected
                    ? 'bg-gray-900 text-white'
                    : hasEvents && isCurrentMonth
                      ? 'bg-blue-500 text-white'
                      : isCurrentMonth
                        ? 'text-gray-700 hover:bg-gray-100'
                        : 'hover:bg-gray-50'}
                `}
              >
                {format(date, 'd')}
              </button>
            );
          })}
        </div>

        {/* Clear selection */}
        {selectedDate && (
          <button
            onClick={() => onSelectDate(null)}
            className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700"
          >
            Clear selection
          </button>
        )}
      </div>
    </div>
  );
}

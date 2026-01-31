'use client';

import { useState, useEffect, useRef } from 'react';
import { Source } from '@/lib/types';
import {
  SquiggleSettings,
  fetchSquiggleSettings,
  saveSquiggleSettings,
  setSquiggleSettingsCache,
  TagSquigglePosition,
  positionToSquiggleParams,
} from '@/lib/squiggleSettings';
import { getTagColor } from '@/lib/tagColors';

interface SquigglesPageProps {
  initialSources: Source[];
}

// Generate a seeded random number
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate preview squiggle path
function generatePreviewSquiggle(
  width: number,
  height: number,
  position: TagSquigglePosition
): string {
  const { wiggleAmount, segmentLength, tension, chaos } = positionToSquiggleParams(position);

  // Very ordered and rigid = clean rectangle
  if (position.x < 0.1 && position.y < 0.1) {
    const r = 5;
    return `M ${r} 0 L ${width - r} 0 Q ${width} 0 ${width} ${r} L ${width} ${height - r} Q ${width} ${height} ${width - r} ${height} L ${r} ${height} Q 0 ${height} 0 ${height - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
  }

  let seedCounter = 42;
  const wiggle = () => {
    seedCounter++;
    const baseWiggle = (seededRandom(seedCounter) - 0.5) * wiggleAmount * 2;
    const chaosMultiplier = 1 + (seededRandom(seedCounter + 1000) - 0.5) * chaos * 1.5;
    return baseWiggle * chaosMultiplier;
  };

  const getSegmentStep = () => {
    if (chaos < 0.2) return segmentLength;
    const variation = (seededRandom(seedCounter++) - 0.5) * chaos * segmentLength * 0.6;
    return Math.max(6, segmentLength + variation);
  };

  const margin = 4;
  const allPoints: { x: number; y: number }[] = [];

  // Generate points around the rectangle
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

function SquigglePreview({ position }: { position: TagSquigglePosition }) {
  const path = generatePreviewSquiggle(120, 60, position);
  return (
    <svg width={120} height={60} className="overflow-visible">
      <path
        d={path}
        fill="white"
        stroke="#d3d3d3"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SquigglesPage({ initialSources }: SquigglesPageProps) {
  const [settings, setSettings] = useState<SquiggleSettings>({});
  const [draggedTag, setDraggedTag] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Get all unique tags from sources
  const allTags = new Set<string>();
  initialSources.forEach((source) => {
    if (source.tags) {
      source.tags.split(',').forEach((tag) => {
        const trimmed = tag.trim().toLowerCase();
        if (trimmed) allTags.add(trimmed);
      });
    }
  });
  const sortedTags = Array.from(allTags).sort();

  useEffect(() => {
    fetchSquiggleSettings().then((s) => {
      setSettings(s);
      setSquiggleSettingsCache(s);
    });
  }, []);

  const assignedTags = sortedTags.filter((tag) => settings[tag]);
  const unassignedTags = sortedTags.filter((tag) => !settings[tag]);

  const handleGridDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedTag || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const newSettings = { ...settings, [draggedTag]: { x, y } };
    setSettings(newSettings);
    saveSquiggleSettings(newSettings);
    setDraggedTag(null);
  };

  const handleUnassignedDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedTag) return;

    const newSettings = { ...settings };
    delete newSettings[draggedTag];
    setSettings(newSettings);
    saveSquiggleSettings(newSettings);
    setDraggedTag(null);
  };

  const handleTagDragStart = (tag: string) => {
    setDraggedTag(tag);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Allow clicking to reposition already-assigned tags
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    // Find if clicking near an existing tag and update its position
    // For now, this just updates position on drag
  };

  // Preview squiggle based on cursor position during drag
  const [previewPosition, setPreviewPosition] = useState<TagSquigglePosition>({ x: 0.5, y: 0.5 });

  const handleGridDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setPreviewPosition({ x, y });
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Manage Squiggles</h1>
            <div className="flex gap-4">
              <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
                ← Back to Events
              </a>
              <a href="/sources" className="text-sm text-gray-600 hover:text-gray-900">
                Manage Sources
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-gray-600 mb-6">
          Drag tags onto the grid to assign squiggle styles. Position determines the vibe:
          <br />
          <strong>→ Order ↔ Chaos:</strong> Left = periodic, predictable patterns. Right = random, chaotic.
          <br />
          <strong>↓ Smooth ↔ Active:</strong> Top = low frequency, gentle. Bottom = high frequency, energetic.
        </p>

        <div className="flex gap-8">
          {/* Main Grid */}
          <div className="flex-1">
            <div
              ref={gridRef}
              className="relative bg-white border-2 border-gray-300 rounded-lg aspect-square cursor-crosshair"
              onDrop={handleGridDrop}
              onDragOver={handleGridDragOver}
              onClick={handleGridClick}
            >
              {/* Grid lines */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
                <div className="border-r border-b border-gray-200" />
                <div className="border-b border-gray-200" />
                <div className="border-r border-gray-200" />
                <div />
              </div>

              {/* Axis labels */}
              <div className="absolute -bottom-8 left-0 right-0 flex justify-between text-xs text-gray-500">
                <span>Order</span>
                <span className="font-medium">← → Chaos</span>
                <span>Chaos</span>
              </div>
              <div className="absolute -left-8 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500">
                <span className="origin-left -rotate-90 translate-y-4">Smooth</span>
                <span className="origin-left -rotate-90 translate-y-6 font-medium">↑ ↓</span>
                <span className="origin-left -rotate-90 translate-y-4">Active</span>
              </div>

              {/* Corner previews with labels */}
              <div className="absolute top-2 left-2 opacity-40 pointer-events-none">
                <div className="text-[9px] text-gray-500 mb-1 text-center">Order + Smooth</div>
                <SquigglePreview position={{ x: 0, y: 0 }} />
              </div>
              <div className="absolute top-2 right-2 opacity-40 pointer-events-none">
                <div className="text-[9px] text-gray-500 mb-1 text-center">Chaos + Smooth</div>
                <SquigglePreview position={{ x: 1, y: 0 }} />
              </div>
              <div className="absolute bottom-2 left-2 opacity-40 pointer-events-none">
                <div className="text-[9px] text-gray-500 mb-1 text-center">Order + Active</div>
                <SquigglePreview position={{ x: 0, y: 1 }} />
              </div>
              <div className="absolute bottom-2 right-2 opacity-40 pointer-events-none">
                <div className="text-[9px] text-gray-500 mb-1 text-center">Chaos + Active</div>
                <SquigglePreview position={{ x: 1, y: 1 }} />
              </div>

              {/* Live preview on grid while dragging */}
              {draggedTag && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-5 transition-all duration-75"
                  style={{
                    left: `${previewPosition.x * 100}%`,
                    top: `${previewPosition.y * 100}%`,
                  }}
                >
                  <SquigglePreview position={previewPosition} />
                  <div className="text-[10px] text-gray-500 text-center mt-1">
                    {(previewPosition.x * 100).toFixed(0)}% / {(previewPosition.y * 100).toFixed(0)}%
                  </div>
                </div>
              )}

              {/* Assigned tags */}
              {assignedTags.map((tag) => {
                const pos = settings[tag];
                const colors = getTagColor(tag);
                const isBeingDragged = draggedTag === tag;
                return (
                  <div
                    key={tag}
                    draggable
                    onDragStart={() => handleTagDragStart(tag)}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-10 transition-opacity ${isBeingDragged ? 'opacity-30' : ''}`}
                    style={{
                      left: `${pos.x * 100}%`,
                      top: `${pos.y * 100}%`,
                    }}
                  >
                    {/* Squiggle preview behind the tag */}
                    <div className="absolute -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 -z-10">
                      <SquigglePreview position={pos} />
                    </div>
                    <span
                      className="relative px-2 py-1 text-xs font-medium rounded-full shadow-md border-2 border-white"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                    >
                      {tag}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unassigned Tags */}
          <div className="w-48">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Unassigned Tags</h3>
            <p className="text-xs text-gray-500 mb-3">
              Drag to grid to assign squiggles. Unassigned = straight borders.
            </p>
            <div
              className="min-h-[200px] p-3 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300"
              onDrop={handleUnassignedDrop}
              onDragOver={handleDragOver}
            >
              {unassignedTags.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  All tags assigned!
                  <br />
                  Drag here to unassign.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {unassignedTags.map((tag) => {
                    const colors = getTagColor(tag);
                    return (
                      <span
                        key={tag}
                        draggable
                        onDragStart={() => handleTagDragStart(tag)}
                        className="px-2 py-1 text-xs font-medium rounded-full cursor-grab active:cursor-grabbing"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Assigned tags list */}
            {assignedTags.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Assigned Tags</h3>
                <div className="space-y-1.5">
                  {assignedTags.map((tag) => {
                    const pos = settings[tag];
                    const colors = getTagColor(tag);
                    return (
                      <div
                        key={tag}
                        className="flex items-center justify-between text-xs"
                      >
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                          {tag}
                        </span>
                        <span className="text-gray-400">
                          {(pos.x * 100).toFixed(0)}%, {(pos.y * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

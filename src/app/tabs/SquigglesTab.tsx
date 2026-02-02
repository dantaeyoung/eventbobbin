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

interface SquigglesTabProps {
  sources: Source[];
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generatePreviewSquiggle(width: number, height: number, position: TagSquigglePosition): string {
  const { wiggleAmount, segmentLength, tension, chaos } = positionToSquiggleParams(position);
  if (position.x < 0.1 && position.y < 0.1) {
    const r = 5;
    return `M ${r} 0 L ${width - r} 0 Q ${width} 0 ${width} ${r} L ${width} ${height - r} Q ${width} ${height} ${width - r} ${height} L ${r} ${height} Q 0 ${height} 0 ${height - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
  }
  let seedCounter = 42;
  const frequency = 0.4;
  const getWiggle = (perimeterPos: number) => {
    seedCounter++;
    const periodicWiggle = Math.sin(perimeterPos * frequency + 42 * 0.1) * wiggleAmount;
    const randomWiggle = (seededRandom(seedCounter) - 0.5) * wiggleAmount * 2;
    return periodicWiggle * (1 - chaos) + randomWiggle * chaos;
  };
  const getSegmentStep = () => {
    if (chaos < 0.3) return segmentLength;
    const variation = (seededRandom(seedCounter++) - 0.5) * chaos * segmentLength * 0.5;
    return Math.max(6, segmentLength + variation);
  };
  const margin = 4;
  const allPoints: { x: number; y: number }[] = [];
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

export function SquigglesTab({ sources }: SquigglesTabProps) {
  const [settings, setSettings] = useState<SquiggleSettings>({});
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<TagSquigglePosition | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const allTags = Array.from(new Set(
    sources.flatMap(s => s.tags ? s.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [])
  )).sort();

  useEffect(() => {
    fetchSquiggleSettings().then((s) => {
      setSettings(s);
      setSquiggleSettingsCache(s);
    });
  }, []);

  const handleCanvasInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!selectedTag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    setDragPosition({ x, y });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selectedTag) return;
    isDragging.current = true;
    handleCanvasInteraction(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    handleCanvasInteraction(e);
  };

  const handleMouseUp = () => {
    if (isDragging.current && selectedTag && dragPosition) {
      const newSettings = { ...settings, [selectedTag]: dragPosition };
      setSettings(newSettings);
      saveSquiggleSettings(newSettings);
    }
    isDragging.current = false;
    setDragPosition(null);
  };

  const currentPosition = selectedTag
    ? (dragPosition || settings[selectedTag] || { x: 0, y: 0 })
    : { x: 0.5, y: 0.5 };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Tag Squiggle Settings</h2>
          <p className="text-sm text-gray-600 mb-4">
            Position each tag on the grid to control how its events appear. X-axis: Order → Chaos. Y-axis: Smooth → Active.
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {allTags.map((tag) => {
              const colors = getTagColor(tag);
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(isSelected ? null : tag)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-all ${isSelected ? 'ring-2 ring-offset-2 ring-gray-900' : ''}`}
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          {selectedTag && (
            <div className="flex gap-6">
              <div
                ref={canvasRef}
                className="relative w-80 h-80 bg-gray-50 rounded-lg border border-gray-200 cursor-crosshair select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs text-gray-400">Order</div>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-400">Chaos</div>
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 -rotate-90">Smooth</div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 -rotate-90">Active</div>
                <div
                  className="absolute w-6 h-6 rounded-full border-2 border-gray-900 bg-white shadow-lg -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${currentPosition.x * 100}%`, top: `${currentPosition.y * 100}%` }}
                />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-2">Preview: {selectedTag}</h3>
                <svg width="200" height="80" className="border border-gray-200 rounded bg-white">
                  <path d={generatePreviewSquiggle(200, 80, currentPosition)} fill={getTagColor(selectedTag).bg} stroke={getTagColor(selectedTag).text} strokeWidth="1" />
                </svg>
                <p className="text-xs text-gray-500 mt-2">
                  Position: ({currentPosition.x.toFixed(2)}, {currentPosition.y.toFixed(2)})
                </p>
              </div>
            </div>
          )}
          {!selectedTag && (
            <div className="text-center py-12 text-gray-400">Select a tag above to adjust its squiggle style</div>
          )}
        </div>
      </div>
    </main>
  );
}

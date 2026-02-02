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
import {
  ColorScheme,
  COLOR_SCHEMES,
  getStoredSchemeId,
  setStoredSchemeId,
  getCustomScheme,
  setCustomScheme,
  applyColorScheme,
  getSchemeById,
} from '@/lib/colorSchemes';

interface SquigglesTabProps {
  sources: Source[];
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generatePreviewSquiggle(width: number, height: number, position: TagSquigglePosition): string {
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

function SquigglePreview({ position }: { position: TagSquigglePosition }) {
  const path = generatePreviewSquiggle(120, 60, position);
  return (
    <svg width={120} height={60} className="overflow-visible">
      <path d={path} fill="white" stroke="#d3d3d3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SquigglesTab({ sources }: SquigglesTabProps) {
  const [settings, setSettings] = useState<SquiggleSettings>({});
  const [draggedTag, setDraggedTag] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<TagSquigglePosition>({ x: 0.5, y: 0.5 });
  const gridRef = useRef<HTMLDivElement>(null);

  // Color scheme state
  const [currentSchemeId, setCurrentSchemeId] = useState<string>('classic-blue');
  const [customColors, setCustomColors] = useState<ColorScheme['colors'] | null>(null);
  const [editingCustom, setEditingCustom] = useState(false);

  const allTags = Array.from(new Set(
    sources.flatMap(s => s.tags ? s.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [])
  )).sort();

  useEffect(() => {
    fetchSquiggleSettings().then((s) => {
      setSettings(s);
      setSquiggleSettingsCache(s);
    });

    // Load color scheme
    const storedId = getStoredSchemeId();
    setCurrentSchemeId(storedId);
    const scheme = getSchemeById(storedId);
    applyColorScheme(scheme);

    // Load custom colors if exists
    const custom = getCustomScheme();
    if (custom) {
      setCustomColors(custom.colors);
    }
  }, []);

  const handleSchemeChange = (schemeId: string) => {
    setCurrentSchemeId(schemeId);
    setStoredSchemeId(schemeId);
    const scheme = getSchemeById(schemeId);
    applyColorScheme(scheme);
    setEditingCustom(schemeId === 'custom');
  };

  const handleCustomColorChange = (key: keyof ColorScheme['colors'], value: string) => {
    const baseColors = customColors || getSchemeById('classic-blue').colors;
    const newColors = { ...baseColors, [key]: value };
    setCustomColors(newColors);

    const customScheme: ColorScheme = {
      id: 'custom',
      name: 'Custom',
      colors: newColors,
    };
    setCustomScheme(customScheme);

    if (currentSchemeId === 'custom') {
      applyColorScheme(customScheme);
    }
  };

  const currentScheme = getSchemeById(currentSchemeId);

  const assignedTags = allTags.filter((tag) => settings[tag]);
  const unassignedTags = allTags.filter((tag) => !settings[tag]);

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

  const handleGridDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setPreviewPosition({ x, y });
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-gray-600 mb-6">
          Drag tags onto the grid to assign squiggle styles. Position determines the vibe:
          <br />
          <strong>→ Order ↔ Chaos:</strong> Left = regular, predictable patterns. Right = wild, irregular energy.
          <br />
          <strong>↓ Smooth ↔ Active:</strong> Top = tight, controlled. Bottom = loose, flowing, expansive.
        </p>

        <div className="flex gap-8">
          {/* Main Grid */}
          <div className="flex-1">
            <div
              ref={gridRef}
              className="relative bg-white border-2 border-gray-300 rounded-lg aspect-square cursor-crosshair"
              onDrop={handleGridDrop}
              onDragOver={handleGridDragOver}
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

              {/* Corner previews */}
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

              {/* Assigned tags on grid */}
              {assignedTags.map((tag) => {
                const pos = settings[tag];
                const colors = getTagColor(tag);
                return (
                  <div
                    key={tag}
                    draggable
                    onDragStart={() => handleTagDragStart(tag)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-10"
                    style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                  >
                    <span
                      className="px-2 py-1 text-xs font-medium rounded-full shadow-md border-2 border-white"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                    >
                      {tag}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Live preview */}
            <div className="mt-12 p-4 bg-white rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Preview at cursor position:</h3>
              <div className="flex items-center gap-4">
                <SquigglePreview position={previewPosition} />
                <div className="text-xs text-gray-500">
                  Chaos: {(previewPosition.x * 100).toFixed(0)}%
                  <br />
                  Activity: {(previewPosition.y * 100).toFixed(0)}%
                </div>
              </div>
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
                      <div key={tag} className="flex items-center justify-between text-xs">
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

        {/* Color Scheme Section */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Color Scheme</h2>
          <p className="text-gray-600 mb-6">
            Choose a color scheme for the app, or create your own custom theme.
          </p>

          {/* Preset schemes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {COLOR_SCHEMES.map((scheme) => (
              <button
                key={scheme.id}
                onClick={() => handleSchemeChange(scheme.id)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  currentSchemeId === scheme.id
                    ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex gap-1 mb-2">
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: scheme.colors.accent }}
                  />
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: scheme.colors.accentLight }}
                  />
                  <div
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: scheme.colors.background, borderColor: scheme.colors.cardStroke }}
                  />
                </div>
                <div className="text-sm font-medium" style={{ color: scheme.colors.text }}>
                  {scheme.name}
                </div>
              </button>
            ))}

            {/* Custom scheme option */}
            <button
              onClick={() => handleSchemeChange('custom')}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                currentSchemeId === 'custom'
                  ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2'
                  : 'border-dashed border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex gap-1 mb-2">
                {customColors ? (
                  <>
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: customColors.accent }} />
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: customColors.accentLight }} />
                    <div className="w-6 h-6 rounded border" style={{ backgroundColor: customColors.background, borderColor: customColors.cardStroke }} />
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400" />
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-green-400 via-yellow-400 to-orange-400" />
                    <div className="w-6 h-6 rounded border border-gray-300 bg-white flex items-center justify-center text-gray-400 text-xs">+</div>
                  </>
                )}
              </div>
              <div className="text-sm font-medium text-gray-700">Custom</div>
            </button>
          </div>

          {/* Custom color editor */}
          {currentSchemeId === 'custom' && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Customize Colors</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { key: 'accent', label: 'Accent' },
                  { key: 'accentLight', label: 'Container' },
                  { key: 'accentStroke', label: 'Container Border' },
                  { key: 'background', label: 'Background' },
                  { key: 'cardBg', label: 'Card' },
                  { key: 'cardStroke', label: 'Card Border' },
                  { key: 'text', label: 'Text' },
                  { key: 'textMuted', label: 'Muted Text' },
                ].map(({ key, label }) => {
                  const colors = customColors || getSchemeById('classic-blue').colors;
                  return (
                    <div key={key}>
                      <label className="block text-xs text-gray-600 mb-1">{label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={colors[key as keyof ColorScheme['colors']]}
                          onChange={(e) => handleCustomColorChange(key as keyof ColorScheme['colors'], e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                        />
                        <input
                          type="text"
                          value={colors[key as keyof ColorScheme['colors']]}
                          onChange={(e) => handleCustomColorChange(key as keyof ColorScheme['colors'], e.target.value)}
                          className="flex-1 px-2 py-1 text-xs font-mono border border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: currentScheme.colors.background }}>
            <h3 className="text-sm font-medium mb-3" style={{ color: currentScheme.colors.text }}>Preview</h3>
            <div className="p-3 rounded-lg" style={{ backgroundColor: currentScheme.colors.accentLight, border: `2px solid ${currentScheme.colors.accentStroke}` }}>
              <div className="text-sm font-bold mb-2" style={{ color: currentScheme.colors.accent }}>
                Saturday, Feb 1
              </div>
              <div className="p-3 rounded" style={{ backgroundColor: currentScheme.colors.cardBg, border: `1px solid ${currentScheme.colors.cardStroke}` }}>
                <div className="font-medium" style={{ color: currentScheme.colors.text }}>Sample Event Title</div>
                <div className="text-sm" style={{ color: currentScheme.colors.textMuted }}>Sample description text here</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

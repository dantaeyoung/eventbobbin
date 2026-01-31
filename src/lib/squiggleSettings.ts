// Squiggle settings for tags
// X-axis: Order (0) ↔ Chaos (1) - regularity vs randomness
// Y-axis: Rigid (0) ↔ Open (1) - tight/angular vs loose/flowing

import { getApiUrl } from './api';

export interface TagSquigglePosition {
  x: number; // 0-1, order → chaos
  y: number; // 0-1, rigid → open
}

export interface SquiggleSettings {
  [tag: string]: TagSquigglePosition;
}

const SETTINGS_KEY = 'squiggle-settings';
const LOCAL_STORAGE_KEY = 'eventbobbin-squiggle-settings';

// Fetch squiggle settings from API
export async function fetchSquiggleSettings(): Promise<SquiggleSettings> {
  try {
    const baseUrl = getApiUrl();
    const res = await fetch(`${baseUrl}/api/settings/${SETTINGS_KEY}`);
    if (res.ok) {
      const data = await res.json();
      return data.value || {};
    }
  } catch {
    // Fall back to localStorage if API unavailable
  }

  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // ignore
      }
    }
  }
  return {};
}

// Save squiggle settings to API
export async function saveSquiggleSettingsToAPI(settings: SquiggleSettings): Promise<void> {
  try {
    const baseUrl = getApiUrl();
    await fetch(`${baseUrl}/api/settings/${SETTINGS_KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: settings }),
    });
  } catch {
    // Silently fail, will use localStorage as backup
  }

  // Also save to localStorage as backup
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  }
}

// Synchronous getters for use in components (use cached data)
let cachedSettings: SquiggleSettings = {};

export function getSquiggleSettings(): SquiggleSettings {
  return cachedSettings;
}

export function setSquiggleSettingsCache(settings: SquiggleSettings): void {
  cachedSettings = settings;
}

export function saveSquiggleSettings(settings: SquiggleSettings): void {
  cachedSettings = settings;
  saveSquiggleSettingsToAPI(settings);
}

export function getTagSquigglePosition(tag: string): TagSquigglePosition {
  return cachedSettings[tag.toLowerCase().trim()] || { x: 0, y: 0 };
}

export function setTagSquigglePosition(tag: string, position: TagSquigglePosition): void {
  cachedSettings[tag.toLowerCase().trim()] = position;
  saveSquiggleSettingsToAPI(cachedSettings);
}

export function removeTagSquigglePosition(tag: string): void {
  delete cachedSettings[tag.toLowerCase().trim()];
  saveSquiggleSettingsToAPI(cachedSettings);
}

// Calculate average squiggle position for multiple tags
export function getAverageSquigglePosition(tags: string[]): TagSquigglePosition {
  if (tags.length === 0) return { x: 0, y: 0 };

  let totalX = 0;
  let totalY = 0;
  let count = 0;

  for (const tag of tags) {
    const pos = cachedSettings[tag.toLowerCase().trim()];
    if (pos) {
      totalX += pos.x;
      totalY += pos.y;
      count++;
    }
  }

  if (count === 0) return { x: 0, y: 0 };

  return {
    x: totalX / count,
    y: totalY / count,
  };
}

// Convert position to squiggle parameters
// X: Order → Chaos (periodicity vs randomness)
// Y: Smooth → Active (low frequency vs high frequency)
export function positionToSquiggleParams(position: TagSquigglePosition): {
  wiggleAmount: number;
  segmentLength: number;
  tension: number;
  chaos: number; // 0-1, affects randomness variation
} {
  const chaos = position.x; // 0 = periodic/regular, 1 = random/chaotic
  const activity = position.y; // 0 = smooth/low frequency, 1 = active/high frequency

  // Activity affects frequency (segment length) and amplitude
  // Smooth (0): long segments, gentle curves, low amplitude
  // Active (1): short segments, many wiggles, higher amplitude
  const segmentLength = 40 - (activity * 28); // 40 (smooth) to 12 (active)
  const wiggleAmount = 2 + (activity * 6); // 2 (gentle) to 8 (energetic)

  // Tension affects curve smoothness - keep it relatively smooth
  const tension = 6 - (activity * 2); // 6 (smoother) to 4 (slightly sharper)

  // Chaos affects randomness in wiggle positions
  // Order (0): periodic, predictable pattern
  // Chaos (1): random, unpredictable

  return { wiggleAmount, segmentLength, tension, chaos };
}

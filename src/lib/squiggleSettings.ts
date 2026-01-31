// Squiggle settings for tags
// X-axis: Order (0) ↔ Chaos (1) - regularity vs randomness
// Y-axis: Rigid (0) ↔ Open (1) - tight/angular vs loose/flowing

export interface TagSquigglePosition {
  x: number; // 0-1, order → chaos
  y: number; // 0-1, rigid → open
}

export interface SquiggleSettings {
  [tag: string]: TagSquigglePosition;
}

const STORAGE_KEY = 'eventbobbin-squiggle-settings';

export function getSquiggleSettings(): SquiggleSettings {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return {};
    }
  }
  return {};
}

export function saveSquiggleSettings(settings: SquiggleSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getTagSquigglePosition(tag: string): TagSquigglePosition {
  const settings = getSquiggleSettings();
  return settings[tag.toLowerCase().trim()] || { x: 0, y: 0 };
}

export function setTagSquigglePosition(tag: string, position: TagSquigglePosition): void {
  const settings = getSquiggleSettings();
  settings[tag.toLowerCase().trim()] = position;
  saveSquiggleSettings(settings);
}

export function removeTagSquigglePosition(tag: string): void {
  const settings = getSquiggleSettings();
  delete settings[tag.toLowerCase().trim()];
  saveSquiggleSettings(settings);
}

// Calculate average squiggle position for multiple tags
export function getAverageSquigglePosition(tags: string[]): TagSquigglePosition {
  if (tags.length === 0) return { x: 0, y: 0 };

  const settings = getSquiggleSettings();
  let totalX = 0;
  let totalY = 0;
  let count = 0;

  for (const tag of tags) {
    const pos = settings[tag.toLowerCase().trim()];
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
// X: Order → Chaos (randomness, irregularity)
// Y: Rigid → Open (smoothness, amplitude, breathing room)
export function positionToSquiggleParams(position: TagSquigglePosition): {
  wiggleAmount: number;
  segmentLength: number;
  tension: number;
  chaos: number; // 0-1, affects randomness variation
} {
  const chaos = position.x; // 0 = perfectly regular, 1 = highly irregular
  const openness = position.y; // 0 = tight/rigid, 1 = loose/open

  // Openness affects amplitude and smoothness
  // Rigid (0): small wiggles, sharp angles (high tension)
  // Open (1): large flowing curves, smooth (low tension)
  const wiggleAmount = 2 + (openness * 6); // 2 to 8
  const tension = 10 - (openness * 6); // 10 (sharp) to 4 (smooth)

  // Chaos affects segment length (irregular = varying density)
  // Order (0): regular spacing
  // Chaos (1): denser, more erratic
  const segmentLength = 24 - (chaos * 12); // 24 to 12

  return { wiggleAmount, segmentLength, tension, chaos };
}

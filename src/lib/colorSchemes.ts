// Color scheme definitions and management

export interface ColorScheme {
  id: string;
  name: string;
  colors: {
    accent: string;           // Primary accent (date headers, links)
    accentLight: string;      // Light accent (container backgrounds)
    accentStroke: string;     // Container strokes
    background: string;       // Page/tab background
    cardBg: string;           // Card backgrounds
    cardStroke: string;       // Card strokes
    text: string;             // Primary text
    textMuted: string;        // Secondary text
  };
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: 'classic-blue',
    name: 'Classic Blue',
    colors: {
      accent: '#2e32ff',
      accentLight: '#e8e8ff',
      accentStroke: '#c8c8ff',
      background: '#FFF8F0',
      cardBg: '#ffffff',
      cardStroke: '#d3d3d3',
      text: '#1a1a1a',
      textMuted: '#6b7280',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      accent: '#2d6a4f',
      accentLight: '#d8f3dc',
      accentStroke: '#95d5b2',
      background: '#f0f7f4',
      cardBg: '#ffffff',
      cardStroke: '#b7e4c7',
      text: '#1b4332',
      textMuted: '#52796f',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: {
      accent: '#c2410c',
      accentLight: '#ffedd5',
      accentStroke: '#fdba74',
      background: '#fffbeb',
      cardBg: '#ffffff',
      cardStroke: '#fed7aa',
      text: '#431407',
      textMuted: '#9a3412',
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    colors: {
      accent: '#7c3aed',
      accentLight: '#ede9fe',
      accentStroke: '#c4b5fd',
      background: '#faf5ff',
      cardBg: '#ffffff',
      cardStroke: '#ddd6fe',
      text: '#3b0764',
      textMuted: '#6b21a8',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      accent: '#0369a1',
      accentLight: '#e0f2fe',
      accentStroke: '#7dd3fc',
      background: '#f0f9ff',
      cardBg: '#ffffff',
      cardStroke: '#bae6fd',
      text: '#0c4a6e',
      textMuted: '#0284c7',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    colors: {
      accent: '#be185d',
      accentLight: '#fce7f3',
      accentStroke: '#f9a8d4',
      background: '#fdf2f8',
      cardBg: '#ffffff',
      cardStroke: '#fbcfe8',
      text: '#500724',
      textMuted: '#9d174d',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    colors: {
      accent: '#475569',
      accentLight: '#f1f5f9',
      accentStroke: '#cbd5e1',
      background: '#f8fafc',
      cardBg: '#ffffff',
      cardStroke: '#e2e8f0',
      text: '#0f172a',
      textMuted: '#64748b',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      accent: '#818cf8',
      accentLight: '#1e1b4b',
      accentStroke: '#3730a3',
      background: '#0f0d1a',
      cardBg: '#1a1625',
      cardStroke: '#312e81',
      text: '#e0e7ff',
      textMuted: '#a5b4fc',
    },
  },
];

const STORAGE_KEY = 'eventbobbin-color-scheme';
const CUSTOM_SCHEME_KEY = 'eventbobbin-custom-scheme';

export function getStoredSchemeId(): string {
  if (typeof window === 'undefined') return 'classic-blue';
  return localStorage.getItem(STORAGE_KEY) || 'classic-blue';
}

export function setStoredSchemeId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, id);
}

export function getCustomScheme(): ColorScheme | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(CUSTOM_SCHEME_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

export function setCustomScheme(scheme: ColorScheme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOM_SCHEME_KEY, JSON.stringify(scheme));
}

export function getSchemeById(id: string): ColorScheme {
  if (id === 'custom') {
    const custom = getCustomScheme();
    if (custom) return custom;
  }
  return COLOR_SCHEMES.find((s) => s.id === id) || COLOR_SCHEMES[0];
}

export function applyColorScheme(scheme: ColorScheme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--color-accent', scheme.colors.accent);
  root.style.setProperty('--color-accent-light', scheme.colors.accentLight);
  root.style.setProperty('--color-accent-stroke', scheme.colors.accentStroke);
  root.style.setProperty('--color-background', scheme.colors.background);
  root.style.setProperty('--color-card-bg', scheme.colors.cardBg);
  root.style.setProperty('--color-card-stroke', scheme.colors.cardStroke);
  root.style.setProperty('--color-text', scheme.colors.text);
  root.style.setProperty('--color-text-muted', scheme.colors.textMuted);
}

export function getCurrentScheme(): ColorScheme {
  const id = getStoredSchemeId();
  return getSchemeById(id);
}

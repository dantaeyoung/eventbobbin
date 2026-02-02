// API client for internal API routes

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = path;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  // Check if response is actually JSON before parsing
  const text = await res.text();
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) {
    throw new Error(`API returned non-JSON response: ${text.slice(0, 100)}`);
  }

  return JSON.parse(text);
}

// Typed API methods
export const api = {
  // Events
  getEvents: (params?: { from?: string; to?: string; sources?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    if (params?.sources) searchParams.set('sources', params.sources);
    const query = searchParams.toString();
    return apiFetch<Event[]>(`/api/events${query ? `?${query}` : ''}`);
  },

  deleteEvent: (id: string) =>
    apiFetch(`/api/events/${id}`, { method: 'DELETE' }),

  // Sources
  getSources: () => apiFetch<Source[]>('/api/sources'),

  createSource: (data: {
    name: string;
    url: string;
    scrapeInstructions?: string | null;
    tags?: string | null;
    city?: string | null;
  }) =>
    apiFetch<Source>('/api/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSource: (id: string, data: Partial<Source>) =>
    apiFetch<Source>(`/api/sources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSource: (id: string) =>
    apiFetch(`/api/sources/${id}`, { method: 'DELETE' }),

  scrapeSource: (id: string, force?: boolean) =>
    apiFetch<{ success: boolean; eventsFound?: number; error?: string; skipped?: boolean; alreadyScraping?: boolean }>(
      `/api/sources/${id}/scrape${force ? '?force=true' : ''}`,
      { method: 'POST' }
    ),
};

// Re-export types for convenience
import type { Event, Source } from './types';

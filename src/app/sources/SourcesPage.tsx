'use client';

import { useState, useEffect, useCallback } from 'react';
import { Source } from '@/lib/types';
import { format } from 'date-fns';

const STORAGE_KEY = 'eventbobbin-scraping';
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

interface ScrapingState {
  [sourceId: string]: number; // timestamp when scrape started
}

function loadScrapingState(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set();
    const state: ScrapingState = JSON.parse(stored);
    const now = Date.now();
    // Filter out stale entries (older than 5 minutes)
    const active = Object.entries(state)
      .filter(([, timestamp]) => now - timestamp < STALE_THRESHOLD_MS)
      .map(([id]) => id);
    return new Set(active);
  } catch {
    return new Set();
  }
}

function saveScrapingState(scraping: Set<string>) {
  if (typeof window === 'undefined') return;
  // Preserve existing timestamps, only add new ones
  let existing: ScrapingState = {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) existing = JSON.parse(stored);
  } catch {
    // ignore
  }
  const state: ScrapingState = {};
  const now = Date.now();
  scraping.forEach((id) => {
    state[id] = existing[id] || now;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

interface SourcesPageProps {
  initialSources: Source[];
}

export function SourcesPage({ initialSources }: SourcesPageProps) {
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [scraping, setScraping] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // Load scraping state from localStorage on mount
  useEffect(() => {
    setScraping(loadScrapingState());
    setMounted(true);
  }, []);

  // Save scraping state to localStorage when it changes
  useEffect(() => {
    if (mounted) {
      saveScrapingState(scraping);
    }
  }, [scraping, mounted]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;

    setAdding(true);
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url }),
      });
      if (res.ok) {
        const source = await res.json();
        setSources([...sources, source]);
        setName('');
        setUrl('');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this source and all its events?')) return;

    const res = await fetch(`/api/sources/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSources(sources.filter((s) => s.id !== id));
    }
  };

  const handleToggle = async (source: Source) => {
    const res = await fetch(`/api/sources/${source.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !source.enabled }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSources(sources.map((s) => (s.id === source.id ? updated : s)));
    }
  };

  const handleScrape = async (id: string) => {
    setScraping((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/sources/${id}/scrape`, { method: 'POST' });
      const result = await res.json();
      alert(
        result.success
          ? `Found ${result.eventsFound} events${result.skipped ? ' (no changes)' : ''}`
          : `Error: ${result.error}`
      );
      // Refresh sources to get updated lastScrapedAt
      const sourcesRes = await fetch('/api/sources');
      setSources(await sourcesRes.json());
    } finally {
      setScraping((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Manage Sources</h1>
            <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back to Events
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleAdd} className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
          <h2 className="font-semibold mb-4">Add New Source</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Source name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <input
              type="url"
              placeholder="https://example.com/events"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-[2] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="submit"
              disabled={adding || !name || !url}
              className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {sources.map((source) => (
            <div
              key={source.id}
              className={`p-4 bg-white rounded-lg border border-gray-200 ${
                !source.enabled ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{source.name}</h3>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate block"
                  >
                    {source.url}
                  </a>
                  <div className="text-sm text-gray-500 mt-1">
                    {source.lastScrapedAt
                      ? `Last scraped: ${format(new Date(source.lastScrapedAt), 'MMM d, h:mm a')}`
                      : 'Never scraped'}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleScrape(source.id)}
                    disabled={scraping.has(source.id)}
                    className="px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                  >
                    {scraping.has(source.id) ? 'Scraping...' : 'Scrape Now'}
                  </button>
                  <button
                    onClick={() => handleToggle(source)}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      source.enabled
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {source.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => handleDelete(source.id)}
                    className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-md hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {sources.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No sources yet. Add one above!
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

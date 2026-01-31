'use client';

import { useState, useEffect } from 'react';
import { Source } from '@/lib/types';
import { format } from 'date-fns';
import { ToastContainer, useToasts } from '@/components/Toast';

function formatElapsed(startTime: string): string {
  const seconds = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface SourcesPageProps {
  initialSources: Source[];
}

export function SourcesPage({ initialSources }: SourcesPageProps) {
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [tags, setTags] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<'instructions' | 'tags'>('instructions');
  const [editValue, setEditValue] = useState('');
  const [, setTick] = useState(0); // Force re-render for timer
  const { toasts, addToast, removeToast } = useToasts();

  // Check for any sources currently scraping
  const hasScrapingSource = sources.some((s) => s.scrapingStartedAt);

  // Timer tick for elapsed time display + poll for updates while scraping
  useEffect(() => {
    if (!hasScrapingSource) return;
    const interval = setInterval(async () => {
      setTick((t) => t + 1);
      // Poll for source updates every 2 seconds
      const res = await fetch('/api/sources');
      if (res.ok) {
        setSources(await res.json());
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [hasScrapingSource]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;

    setAdding(true);
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          scrapeInstructions: instructions || null,
          tags: tags || null,
        }),
      });
      if (res.ok) {
        const source = await res.json();
        setSources([...sources, source]);
        setName('');
        setUrl('');
        setInstructions('');
        setTags('');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (source: Source, field: 'instructions' | 'tags') => {
    setEditingId(source.id);
    setEditField(field);
    setEditValue(field === 'instructions' ? source.scrapeInstructions || '' : source.tags || '');
  };

  const handleSaveEdit = async (id: string) => {
    const body = editField === 'instructions'
      ? { scrapeInstructions: editValue || null }
      : { tags: editValue || null };
    const res = await fetch(`/api/sources/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setSources(sources.map((s) => (s.id === id ? updated : s)));
      setEditingId(null);
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

  const handleScrape = async (id: string, force: boolean = false) => {
    const scrapeUrl = `/api/sources/${id}/scrape${force ? '?force=true' : ''}`;
    const res = await fetch(scrapeUrl, { method: 'POST' });
    const result = await res.json();

    if (result.alreadyScraping) {
      addToast('Already scraping this source', 'info');
      return;
    }

    if (result.success) {
      addToast(
        result.skipped
          ? 'No changes detected'
          : `Found ${result.eventsFound} event${result.eventsFound !== 1 ? 's' : ''}`,
        'success'
      );
    } else {
      addToast(`Error: ${result.error}`, 'error');
    }

    // Refresh sources to get updated state
    const sourcesRes = await fetch('/api/sources');
    setSources(await sourcesRes.json());
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
          <div className="space-y-3">
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
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Tags (optional) e.g., 'museum, movement, art'"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
              />
              <input
                type="text"
                placeholder="Filter instructions (optional)"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
              />
              <button
                type="submit"
                disabled={adding || !name || !url}
                className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
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
                  {/* Tags display */}
                  {source.tags && editingId !== source.id && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {source.tags.split(',').map((tag, i) => (
                        <span
                          key={i}
                          onClick={() => handleEdit(source, 'tags')}
                          className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full cursor-pointer hover:bg-blue-200"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  {!source.tags && editingId !== source.id && (
                    <button
                      onClick={() => handleEdit(source, 'tags')}
                      className="text-sm text-gray-400 mt-1 hover:text-gray-600"
                    >
                      + Add tags
                    </button>
                  )}
                  {/* Edit form */}
                  {editingId === source.id ? (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder={editField === 'tags' ? "Tags (comma-separated)" : "Filter instructions"}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(source.id)}
                        className="px-2 py-1 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 text-sm bg-gray-100 rounded-md hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : source.scrapeInstructions ? (
                    <div
                      onClick={() => handleEdit(source, 'instructions')}
                      className="text-sm text-purple-600 mt-1 cursor-pointer hover:text-purple-800"
                      title="Click to edit"
                    >
                      Filter: {source.scrapeInstructions}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(source, 'instructions')}
                      className="text-sm text-gray-400 hover:text-gray-600"
                    >
                      + Add filter
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => handleScrape(source.id, e.shiftKey)}
                    disabled={!!source.scrapingStartedAt}
                    title="Hold Shift to force re-scrape (ignore cache)"
                    className="px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                  >
                    {source.scrapingStartedAt
                      ? `Scraping... ${formatElapsed(source.scrapingStartedAt)}`
                      : 'Scrape Now'}
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

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

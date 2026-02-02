'use client';

import { useState, useEffect, useMemo } from 'react';
import { Source } from '@/lib/types';
import { format } from 'date-fns';
import { ToastContainer, useToasts } from '@/components/Toast';
import { TagInput } from '@/components/TagInput';
import { getTagColor } from '@/lib/tagColors';
import { api } from '@/lib/api';

const SOURCE_SORT_KEY = 'eventbobbin-source-sort';
const SOURCE_CITY_FILTER_KEY = 'eventbobbin-source-city-filter';
type SourceSort = 'alpha' | 'lastScraped';

function loadSourceSort(): SourceSort {
  if (typeof window === 'undefined') return 'alpha';
  const stored = localStorage.getItem(SOURCE_SORT_KEY);
  if (stored && ['alpha', 'lastScraped'].includes(stored)) return stored as SourceSort;
  return 'alpha';
}

function loadCityFilter(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(SOURCE_CITY_FILTER_KEY) || '';
}

function formatElapsed(startTime: string): string {
  const seconds = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface SourcesTabProps {
  sources: Source[];
  setSources: React.Dispatch<React.SetStateAction<Source[]>>;
  refreshSources: () => Promise<void>;
}

export function SourcesTab({ sources, setSources, refreshSources }: SourcesTabProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [tags, setTags] = useState('');
  const [city, setCity] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<'instructions' | 'tags' | 'name' | 'url' | 'full'>('instructions');
  const [editValue, setEditValue] = useState('');
  const [editForm, setEditForm] = useState({ name: '', url: '', tags: '', instructions: '', city: '' });
  const [, setTick] = useState(0);
  const [sourceSort, setSourceSort] = useState<SourceSort>('alpha');
  const [scrapingAll, setScrapingAll] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [showAddCityModal, setShowAddCityModal] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [addCityTarget, setAddCityTarget] = useState<'add' | 'edit'>('add');
  const { toasts, addToast, removeToast } = useToasts();

  useEffect(() => {
    setSourceSort(loadSourceSort());
    setCityFilter(loadCityFilter());
    setMounted(true);
  }, []);

  useEffect(() => {
    localStorage.setItem(SOURCE_SORT_KEY, sourceSort);
  }, [sourceSort]);

  useEffect(() => {
    if (cityFilter) {
      localStorage.setItem(SOURCE_CITY_FILTER_KEY, cityFilter);
    } else {
      localStorage.removeItem(SOURCE_CITY_FILTER_KEY);
    }
  }, [cityFilter]);

  const sortedSources = useMemo(() => {
    let filtered = [...sources];
    // Apply city filter
    if (cityFilter) {
      filtered = filtered.filter((s) => s.city === cityFilter);
    }
    // Sort
    if (sourceSort === 'alpha') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filtered.sort((a, b) => {
        if (!a.lastScrapedAt && !b.lastScrapedAt) return a.name.localeCompare(b.name);
        if (!a.lastScrapedAt) return -1;
        if (!b.lastScrapedAt) return 1;
        return new Date(a.lastScrapedAt).getTime() - new Date(b.lastScrapedAt).getTime();
      });
    }
    return filtered;
  }, [sources, sourceSort, cityFilter]);

  const allCities = useMemo(() => {
    const citySet = new Set<string>();
    sources.forEach((s) => { if (s.city) citySet.add(s.city); });
    return Array.from(citySet).sort();
  }, [sources]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    sources.forEach((s) => {
      if (s.tags) s.tags.split(',').forEach((t) => { const tr = t.trim().toLowerCase(); if (tr) tagSet.add(tr); });
    });
    return Array.from(tagSet).sort();
  }, [sources]);

  const hasScrapingSource = sources.some((s) => s.scrapingStartedAt);

  useEffect(() => {
    if (!hasScrapingSource) return;
    const interval = setInterval(async () => {
      setTick((t) => t + 1);
      await refreshSources();
    }, 2000);
    return () => clearInterval(interval);
  }, [hasScrapingSource, refreshSources]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;
    setAdding(true);
    try {
      const source = await api.createSource({ name, url, scrapeInstructions: instructions || null, tags: tags || null, city: city || null });
      setSources([...sources, source]);
      setName(''); setUrl(''); setInstructions(''); setTags(''); setCity('');
    } catch (error) {
      console.error('Failed to add source:', error);
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (source: Source, field: 'instructions' | 'tags' | 'full') => {
    setEditingId(source.id);
    setEditField(field);
    if (field === 'full') {
      setEditForm({ name: source.name, url: source.url, tags: source.tags || '', instructions: source.scrapeInstructions || '', city: source.city || '' });
    } else {
      setEditValue(field === 'instructions' ? source.scrapeInstructions || '' : source.tags || '');
    }
  };

  const handleSaveEdit = async (id: string) => {
    try {
      let body: Partial<Source>;
      if (editField === 'full') {
        body = { name: editForm.name, url: editForm.url, tags: editForm.tags || null, scrapeInstructions: editForm.instructions || null, city: editForm.city || null };
      } else if (editField === 'instructions') {
        body = { scrapeInstructions: editValue || null };
      } else {
        body = { tags: editValue || null };
      }
      const updated = await api.updateSource(id, body);
      setSources(sources.map((s) => (s.id === id ? updated : s)));
      setEditingId(null);
    } catch (error) {
      console.error('Failed to save edit:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this source and all its events?')) return;
    try {
      await api.deleteSource(id);
      setSources(sources.filter((s) => s.id !== id));
    } catch (error) {
      console.error('Failed to delete source:', error);
    }
  };

  const handleToggle = async (source: Source) => {
    try {
      const updated = await api.updateSource(source.id, { enabled: !source.enabled });
      setSources(sources.map((s) => (s.id === source.id ? updated : s)));
    } catch (error) {
      console.error('Failed to toggle source:', error);
    }
  };

  const handleScrape = async (id: string, force: boolean = false) => {
    setSources(sources.map((s) => s.id === id ? { ...s, scrapingStartedAt: new Date().toISOString() } : s));
    try {
      const result = await api.scrapeSource(id, force);
      if (result.alreadyScraping) { addToast('Already scraping this source', 'info'); return; }
      if (result.success) {
        addToast(result.skipped ? 'No changes detected' : `Found ${result.eventsFound} event${result.eventsFound !== 1 ? 's' : ''}`, 'success');
      } else {
        addToast(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      addToast(`Error: ${error}`, 'error');
    }
    await refreshSources();
  };

  const handleScrapeAll = async (force: boolean = false) => {
    const enabledSources = sources.filter((s) => s.enabled);
    if (enabledSources.length === 0) { addToast('No enabled sources to scrape', 'info'); return; }
    setScrapingAll(true);
    let totalEvents = 0, successCount = 0, errorCount = 0;
    for (const source of enabledSources) {
      setSources((prev) => prev.map((s) => (s.id === source.id ? { ...s, scrapingStartedAt: new Date().toISOString() } : s)));
      try {
        const result = await api.scrapeSource(source.id, force);
        if (result.success) { totalEvents += result.eventsFound || 0; successCount++; } else { errorCount++; }
      } catch { errorCount++; }
      await refreshSources();
    }
    setScrapingAll(false);
    addToast(`Scraped ${successCount} sources, found ${totalEvents} events${errorCount > 0 ? `, ${errorCount} errors` : ''}`, errorCount > 0 ? 'error' : 'success');
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleAdd} className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
          <h2 className="font-semibold mb-4">Add New Source</h2>
          <div className="space-y-3">
            <div className="flex gap-3">
              <input type="text" placeholder="Source name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <input type="url" placeholder="https://example.com/events" value={url} onChange={(e) => setUrl(e.target.value)} className="flex-[2] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <select
                value={city}
                onChange={(e) => {
                  if (e.target.value === '__add_city__') {
                    setAddCityTarget('add');
                    setShowAddCityModal(true);
                  } else {
                    setCity(e.target.value);
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">City</option>
                {allCities.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__add_city__">+ Add City...</option>
              </select>
            </div>
            <div className="flex gap-3">
              <TagInput value={tags} onChange={setTags} allTags={allTags} placeholder="Tags (optional)" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm" />
              <input type="text" placeholder="AI scrape filter (optional)" value={instructions} onChange={(e) => setInstructions(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm" />
              <button type="submit" disabled={adding || !name || !url} className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50">{adding ? 'Adding...' : 'Add'}</button>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort:</span>
              <button onClick={() => setSourceSort('alpha')} className={`px-3 py-1 text-sm rounded-md ${sourceSort === 'alpha' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>A-Z</button>
              <button onClick={() => setSourceSort('lastScraped')} className={`px-3 py-1 text-sm rounded-md ${sourceSort === 'lastScraped' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Stale</button>
            </div>
            {allCities.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">City:</span>
                <button onClick={() => setCityFilter('')} className={`px-3 py-1 text-sm rounded-md ${cityFilter === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>All</button>
                {allCities.map((c) => (
                  <button key={c} onClick={() => setCityFilter(c)} className={`px-3 py-1 text-sm rounded-md ${cityFilter === c ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{c}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={(e) => handleScrapeAll(e.shiftKey)} disabled={scrapingAll || hasScrapingSource} title="Scrape all enabled sources" className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">{scrapingAll ? 'Scraping All...' : 'Scrape All'}</button>
        </div>

        <div className="space-y-3">
          {sortedSources.map((source) => (
            <div key={source.id} className={`p-4 bg-white rounded-lg border border-gray-200 ${!source.enabled ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {editingId === source.id && editField === 'full' ? (
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Source name" className="flex-1 px-3 py-2 border border-gray-300 rounded-md" autoFocus />
                        <input type="url" value={editForm.url} onChange={(e) => setEditForm({ ...editForm, url: e.target.value })} placeholder="URL" className="flex-[2] px-3 py-2 border border-gray-300 rounded-md" />
                        <select
                          value={editForm.city}
                          onChange={(e) => {
                            if (e.target.value === '__add_city__') {
                              setAddCityTarget('edit');
                              setShowAddCityModal(true);
                            } else {
                              setEditForm({ ...editForm, city: e.target.value });
                            }
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-md bg-white"
                        >
                          <option value="">City</option>
                          {allCities.map((c) => <option key={c} value={c}>{c}</option>)}
                          {editForm.city && !allCities.includes(editForm.city) && (
                            <option value={editForm.city}>{editForm.city}</option>
                          )}
                          <option value="__add_city__">+ Add City...</option>
                        </select>
                      </div>
                      <div className="flex gap-3">
                        <TagInput value={editForm.tags} onChange={(t) => setEditForm({ ...editForm, tags: t })} allTags={allTags} placeholder="Tags" className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" />
                        <input type="text" value={editForm.instructions} onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })} placeholder="AI filter" className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEdit(source.id)} className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800">Save</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                          {source.logoUrl && <img src={source.logoUrl} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                        </div>
                        <h3 className="font-semibold text-gray-900">{source.name}</h3>
                        {source.city && <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">{source.city}</span>}
                        <button onClick={() => handleEdit(source, 'full')} className="text-xs text-gray-400 hover:text-gray-600">Edit</button>
                      </div>
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate block">{source.url}</a>
                      <div className="text-sm text-gray-500 mt-1">
                        <span className="mr-2">{source.eventCount ?? 0} event{source.eventCount !== 1 ? 's' : ''}</span>
                        {source.lastScrapedAt ? `· Last scraped: ${format(new Date(source.lastScrapedAt), 'MMM d, h:mm a')}` : '· Never scraped'}
                      </div>
                      {source.tags && editingId !== source.id && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {source.tags.split(',').map((tag, i) => {
                            const colors = getTagColor(tag.trim());
                            return <span key={i} onClick={() => handleEdit(source, 'tags')} className="px-2 py-0.5 text-xs rounded-full cursor-pointer hover:opacity-80" style={{ backgroundColor: colors.bg, color: colors.text }}>{tag.trim()}</span>;
                          })}
                        </div>
                      )}
                      {!source.tags && editingId !== source.id && <button onClick={() => handleEdit(source, 'tags')} className="text-sm text-gray-400 mt-1 hover:text-gray-600">+ Add tags</button>}
                      {editingId === source.id && editField !== 'full' ? (
                        <div className="flex gap-2 mt-2">
                          {editField === 'tags' ? (
                            <TagInput value={editValue} onChange={setEditValue} allTags={allTags} placeholder="Tags" className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md" autoFocus />
                          ) : (
                            <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="AI filter" className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md" autoFocus />
                          )}
                          <button onClick={() => handleSaveEdit(source.id)} className="px-2 py-1 text-sm bg-gray-900 text-white rounded-md">Save</button>
                          <button onClick={() => setEditingId(null)} className="px-2 py-1 text-sm bg-gray-100 rounded-md">Cancel</button>
                        </div>
                      ) : source.scrapeInstructions ? (
                        <div onClick={() => handleEdit(source, 'instructions')} className="text-sm text-purple-600 mt-1 cursor-pointer hover:text-purple-800">AI filter: {source.scrapeInstructions}</div>
                      ) : (
                        <button onClick={() => handleEdit(source, 'instructions')} className="text-sm text-gray-400 hover:text-gray-600">+ Add AI filter</button>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={(e) => handleScrape(source.id, e.shiftKey)} disabled={!!source.scrapingStartedAt} title="Hold Shift to force" className="px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50">
                    {source.scrapingStartedAt ? `Scraping...${mounted ? ` ${formatElapsed(source.scrapingStartedAt)}` : ''}` : 'Scrape Now'}
                  </button>
                  <button onClick={() => handleToggle(source)} className={`px-3 py-1.5 text-sm rounded-md ${source.enabled ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{source.enabled ? 'Enabled' : 'Disabled'}</button>
                  <button onClick={() => handleDelete(source.id)} className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-md hover:bg-red-200">Delete</button>
                </div>
              </div>
            </div>
          ))}
          {sources.length === 0 && <div className="text-center py-12 text-gray-500">No sources yet. Add one above!</div>}
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Add City Modal */}
      {showAddCityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add New City</h2>
            <input
              type="text"
              placeholder="City name (e.g., Chicago)"
              value={newCityName}
              onChange={(e) => setNewCityName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCityName.trim()) {
                  if (addCityTarget === 'add') {
                    setCity(newCityName.trim());
                  } else {
                    setEditForm({ ...editForm, city: newCityName.trim() });
                  }
                  setNewCityName('');
                  setShowAddCityModal(false);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setNewCityName('');
                  setShowAddCityModal(false);
                }}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newCityName.trim()) {
                    if (addCityTarget === 'add') {
                      setCity(newCityName.trim());
                    } else {
                      setEditForm({ ...editForm, city: newCityName.trim() });
                    }
                    setNewCityName('');
                    setShowAddCityModal(false);
                  }
                }}
                disabled={!newCityName.trim()}
                className="flex-1 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
              >
                Add City
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

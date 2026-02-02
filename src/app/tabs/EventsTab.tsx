'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Event, Source } from '@/lib/types';
import { EventList } from '@/components/EventList';
import { Calendar } from '@/components/Calendar';
import { TagFilter } from '@/components/TagFilter';
import { Tooltip } from '@/components/Tooltip';
import { api } from '@/lib/api';
import { fetchSquiggleSettings, setSquiggleSettingsCache, SquiggleSettings } from '@/lib/squiggleSettings';

const CITY_KEY = 'eventbobbin-city';
const SOURCES_KEY = 'eventbobbin-sources';
const TAGS_KEY = 'eventbobbin-tags';

function getCityFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.slice(1); // Remove #
  if (hash && hash !== 'events') {
    return decodeURIComponent(hash);
  }
  return null;
}

function loadCity(): string | null {
  if (typeof window === 'undefined') return null;
  // First check URL hash, then localStorage
  const hashCity = getCityFromHash();
  if (hashCity) return hashCity;
  return localStorage.getItem(CITY_KEY);
}

function loadSources(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(SOURCES_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { return []; }
  }
  return [];
}

function loadTags(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(TAGS_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { return []; }
  }
  return [];
}

function stringToPastelColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  const s = 50 + (Math.abs((hash >> 8) % 30));
  const l = 80 + (Math.abs((hash >> 16) % 10));
  return `hsl(${h}, ${s}%, ${l}%)`;
}

interface EventsTabProps {
  sources: Source[];
  events: Event[];
  setEvents: (events: Event[]) => void;
  allEvents: Event[];
  setAllEvents: (events: Event[]) => void;
  loading: boolean;
}

export function EventsTab({ sources, events, setEvents, allEvents, setAllEvents, loading: initialLoading }: EventsTabProps) {
  const [selectedSources, setSelectedSources] = useState<string[]>(loadSources);
  const [selectedTags, setSelectedTags] = useState<string[]>(loadTags);
  const [selectedCity, setSelectedCity] = useState<string | null>(loadCity);
  const [squiggleSettings, setSquiggleSettings] = useState<SquiggleSettings>({});
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(initialLoading);
  const [showHelp, setShowHelp] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const cities = useMemo(() => {
    const citySet = new Set<string>();
    sources.forEach((s) => { if (s.city) citySet.add(s.city); });
    return Array.from(citySet).sort();
  }, [sources]);

  const cityFilteredSources = useMemo(() => {
    if (!selectedCity) return sources;
    return sources.filter((s) => s.city === selectedCity);
  }, [sources, selectedCity]);

  const sourceIdsWithSelectedTags = useMemo(() => {
    if (selectedTags.length === 0) return null;
    return cityFilteredSources
      .filter((source) => {
        if (!source.tags) return false;
        const sourceTags = source.tags.split(',').map((t) => t.trim().toLowerCase());
        return selectedTags.some((tag) => sourceTags.includes(tag));
      })
      .map((s) => s.id);
  }, [cityFilteredSources, selectedTags]);

  const citySourceIds = useMemo(() => {
    if (!selectedCity) return null;
    return cityFilteredSources.map((s) => s.id);
  }, [selectedCity, cityFilteredSources]);

  const effectiveSourceIds = useMemo(() => {
    let baseIds = citySourceIds;
    if (sourceIdsWithSelectedTags) {
      baseIds = baseIds
        ? baseIds.filter((id) => sourceIdsWithSelectedTags.includes(id))
        : sourceIdsWithSelectedTags;
    }
    if (selectedSources.length > 0) {
      baseIds = baseIds
        ? baseIds.filter((id) => selectedSources.includes(id))
        : selectedSources;
    }
    return baseIds;
  }, [selectedSources, sourceIdsWithSelectedTags, citySourceIds]);

  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    const filtered = effectiveSourceIds
      ? allEvents.filter((e) => effectiveSourceIds.includes(e.sourceId))
      : allEvents;
    filtered.forEach((e) => { dates.add(e.startDate.split('T')[0]); });
    return dates;
  }, [allEvents, effectiveSourceIds]);

  useEffect(() => {
    setMounted(true);
    fetchSquiggleSettings().then((settings) => {
      setSquiggleSettingsCache(settings);
      setSquiggleSettings(settings);
    });
  }, []);

  useEffect(() => {
    if (mounted) {
      if (selectedCity) {
        localStorage.setItem(CITY_KEY, selectedCity);
        // Update URL hash
        window.history.replaceState(null, '', `#${encodeURIComponent(selectedCity)}`);
      } else {
        localStorage.removeItem(CITY_KEY);
        // Clear hash
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, [selectedCity, mounted]);

  // Handle browser back/forward
  useEffect(() => {
    const handleHashChange = () => {
      const hashCity = getCityFromHash();
      setSelectedCity(hashCity);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (mounted) {
      if (selectedSources.length > 0) {
        localStorage.setItem(SOURCES_KEY, JSON.stringify(selectedSources));
      } else {
        localStorage.removeItem(SOURCES_KEY);
      }
    }
  }, [selectedSources, mounted]);

  useEffect(() => {
    if (mounted) {
      if (selectedTags.length > 0) {
        localStorage.setItem(TAGS_KEY, JSON.stringify(selectedTags));
      } else {
        localStorage.removeItem(TAGS_KEY);
      }
    }
  }, [selectedTags, mounted]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      if (effectiveSourceIds && effectiveSourceIds.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }
      let from: string | undefined;
      let to: string | undefined;
      if (selectedDate) {
        from = startOfDay(selectedDate).toISOString();
        to = endOfDay(selectedDate).toISOString();
      } else {
        from = format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss");
      }
      const data = await api.getEvents({
        from,
        to,
        sources: effectiveSourceIds ? effectiveSourceIds.join(',') : undefined,
      });
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  }, [effectiveSourceIds, selectedDate, setEvents]);

  useEffect(() => {
    if (mounted) {
      fetchEvents();
    }
  }, [fetchEvents, mounted]);

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    try {
      await api.deleteEvent(eventToDelete.id);
      setEvents(events.filter((e) => e.id !== eventToDelete.id));
      setAllEvents(allEvents.filter((e) => e.id !== eventToDelete.id));
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
    setEventToDelete(null);
  };

  return (
    <>
      <main className="flex-1 overflow-hidden max-w-6xl mx-auto px-4 py-4 md:py-6 w-full">
        {/* Mobile filter button */}
        <div className="md:hidden mb-4 flex items-center justify-between">
          <button
            onClick={() => setShowMobileFilters(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm flex items-center gap-2"
          >
            <span>Filters</span>
            {(selectedCity || selectedSources.length > 0 || selectedTags.length > 0) && (
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            )}
          </button>
          {loading && <span className="text-sm text-gray-500">Loading...</span>}
        </div>

        <div className="flex gap-6 h-full">
          {/* Left sidebar */}
          <div className="hidden md:flex md:flex-col flex-shrink-0 w-[280px] h-full px-5">
            <div className="flex-shrink-0">
              <div className="flex justify-center">
                <Calendar
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  eventDates={eventDates}
                />
              </div>
              {cities.length > 0 && (
                <div className="mt-4 px-2">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">City</h3>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setSelectedCity(null)}
                      className={`px-3 py-1 text-sm rounded-md flex items-center gap-1 italic ${
                        selectedCity === null
                          ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white'
                          : 'text-gray-500 border border-dashed border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xs">✱</span>All
                    </button>
                    {cities.map((city) => (
                      <button
                        key={city}
                        onClick={() => setSelectedCity(city)}
                        className={`px-3 py-1 text-sm rounded-md border ${
                          selectedCity === city
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-100'
                        }`}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex-1 min-h-0 overflow-y-auto">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Sources</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedSources([])}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-2 italic ${
                    selectedSources.length === 0
                      ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white'
                      : 'hover:bg-gray-100 text-gray-500 border border-dashed border-gray-300'
                  }`}
                >
                  <span className="text-xs">✱</span>All Sources
                </button>
                {cityFilteredSources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => {
                      if (selectedSources.includes(source.id)) {
                        setSelectedSources(selectedSources.filter((s) => s !== source.id));
                      } else {
                        setSelectedSources([...selectedSources, source.id]);
                      }
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${
                      selectedSources.includes(source.id)
                        ? 'bg-gray-900 text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="w-5 text-right text-xs opacity-60 tabular-nums flex-shrink-0">
                      {source.eventCount || 0}
                    </span>
                    <div
                      className="w-4 h-4 flex-shrink-0 rounded overflow-hidden"
                      style={{ backgroundColor: source.logoUrl ? undefined : stringToPastelColor(source.name) }}
                    >
                      {source.logoUrl && (
                        <img src={source.logoUrl} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                    </div>
                    <span className="truncate">{source.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 flex flex-col h-full relative">
            {loading && <div className="absolute top-0 right-0 text-sm text-gray-500 z-10">Loading...</div>}
            <div className="space-y-4 mb-6 flex-shrink-0">
              {selectedDate && (
                <div className="text-sm text-gray-600">
                  Showing events for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </div>
              )}
              <div className="hidden md:block">
                <TagFilter sources={cityFilteredSources} selected={selectedTags} onChange={setSelectedTags} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <EventList
                events={events}
                sources={sources}
                squiggleSettings={squiggleSettings}
                onEventClick={setSelectedEvent}
                selectedEventId={selectedEvent?.id}
              />
            </div>
          </div>

          {/* Event detail panel */}
          {selectedEvent && (
            <div className="hidden md:flex flex-col fixed right-0 top-[57px] bottom-0 w-[350px] bg-white border-l border-gray-200 z-40">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="font-bold text-gray-900">Event Details</h2>
                <button onClick={() => setSelectedEvent(null)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedEvent.imageUrl && <img src={selectedEvent.imageUrl} alt="" className="w-full rounded-lg" />}
                <h3 className="text-lg font-bold text-gray-900">{selectedEvent.title}</h3>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">{format(new Date(selectedEvent.startDate), 'EEEE, MMMM d, yyyy')}</p>
                  {!selectedEvent.startDate.includes('T00:00:00') && (
                    <Tooltip text="This time was scraped automatically - double check the source to be sure!">
                      <span className="text-sm text-blue-600 font-medium">
                        {format(new Date(selectedEvent.startDate), 'h:mm a')}
                        {selectedEvent.endDate && !selectedEvent.endDate.includes('T00:00:00') && (
                          <> – {format(new Date(selectedEvent.endDate), 'h:mm a')}</>
                        )}
                        <span className="ml-0.5">?</span>
                      </span>
                    </Tooltip>
                  )}
                </div>
                {selectedEvent.location && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Location</p>
                    <p className="text-sm text-gray-700">{selectedEvent.location}</p>
                  </div>
                )}
                {selectedEvent.description && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedEvent.description}</p>
                  </div>
                )}
                {(() => {
                  const eventSource = sources.find(s => s.id === selectedEvent.sourceId);
                  return eventSource && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Source</p>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0" style={{ backgroundColor: eventSource.logoUrl ? undefined : stringToPastelColor(eventSource.name) }}>
                          {eventSource.logoUrl && <img src={eventSource.logoUrl} alt="" className="w-full h-full object-contain" />}
                        </div>
                        <span className="text-sm text-gray-700">{eventSource.name}</span>
                      </div>
                    </div>
                  );
                })()}
                <div className="space-y-2 pt-2">
                  <div className="flex gap-2">
                    {selectedEvent.url && (
                      <a href={selectedEvent.url} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-md text-center hover:bg-blue-700">View Original</a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`https://calendar.google.com/calendar/render?${new URLSearchParams({
                        action: 'TEMPLATE',
                        text: selectedEvent.title,
                        dates: `${selectedEvent.startDate.replace(/[-:]/g, '').split('.')[0]}/${(selectedEvent.endDate || selectedEvent.startDate).replace(/[-:]/g, '').split('.')[0]}`,
                        ...(selectedEvent.location && { location: selectedEvent.location }),
                        ...(selectedEvent.description && { details: selectedEvent.description + (selectedEvent.url ? '\n\n' + selectedEvent.url : '') }),
                      }).toString()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 text-sm font-medium rounded-md text-center hover:bg-gray-200"
                    >
                      Add to Google Calendar
                    </a>
                    <a href={`/api/events/${selectedEvent.id}/ics`} className="py-2 px-4 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200">📅 .ics</a>
                  </div>
                  <button
                    onClick={() => { setEventToDelete(selectedEvent); setSelectedEvent(null); }}
                    className="w-full py-2 px-4 bg-red-50 text-red-600 text-sm font-medium rounded-md hover:bg-red-100"
                  >
                    Delete Event
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete modal */}
      {eventToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Remove Event?</h2>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to remove "{eventToDelete.title}"?</p>
            <div className="flex gap-3">
              <button onClick={() => setEventToDelete(null)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Cancel</button>
              <button onClick={handleDeleteEvent} className="flex-1 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">About EventBobbin</h2>
              <button onClick={() => setShowHelp(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <p><strong>EventBobbin</strong> aggregates events from multiple websites into one place.</p>
            </div>
            <button onClick={() => setShowHelp(false)} className="mt-4 w-full py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800">Got it</button>
          </div>
        </div>
      )}

      {/* Mobile filters modal */}
      {showMobileFilters && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50 md:hidden">
          <div className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Filters</h2>
              <button onClick={() => setShowMobileFilters(false)} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {cities.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">City</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCity(null)}
                      className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1 italic ${
                        selectedCity === null ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white' : 'text-gray-500 border border-dashed border-gray-300'
                      }`}
                    >
                      <span className="text-xs">✱</span>All
                    </button>
                    {cities.map((city) => (
                      <button
                        key={city}
                        onClick={() => setSelectedCity(city)}
                        className={`px-3 py-1.5 text-sm rounded-md border ${
                          selectedCity === city ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-100 text-gray-700 border-gray-100'
                        }`}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
                <TagFilter sources={cityFilteredSources} selected={selectedTags} onChange={setSelectedTags} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Sources</h3>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => setSelectedSources([])}
                    className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 italic ${
                      selectedSources.length === 0 ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white' : 'bg-gray-50 text-gray-500 border border-dashed border-gray-300'
                    }`}
                  >
                    <span className="text-xs">✱</span>All Sources
                  </button>
                  {cityFilteredSources.map((source) => (
                    <button
                      key={source.id}
                      onClick={() => {
                        if (selectedSources.includes(source.id)) {
                          setSelectedSources(selectedSources.filter((s) => s !== source.id));
                        } else {
                          setSelectedSources([...selectedSources, source.id]);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                        selectedSources.includes(source.id) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="w-5 text-right text-xs opacity-60 tabular-nums flex-shrink-0">{source.eventCount || 0}</span>
                      <div className="w-5 h-5 flex-shrink-0 rounded overflow-hidden" style={{ backgroundColor: source.logoUrl ? undefined : stringToPastelColor(source.name) }}>
                        {source.logoUrl && <img src={source.logoUrl} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                      </div>
                      <span className="truncate">{source.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t">
              <button onClick={() => setShowMobileFilters(false)} className="w-full py-3 bg-gray-900 text-white rounded-md font-medium">Apply Filters</button>
              {(selectedCity || selectedSources.length > 0 || selectedTags.length > 0) && (
                <button
                  onClick={() => { setSelectedCity(null); setSelectedSources([]); setSelectedTags([]); }}
                  className="w-full mt-2 py-2 text-gray-600 text-sm"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile event detail modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50 md:hidden">
          <div className="bg-white rounded-t-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Event Details</h2>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedEvent.imageUrl && <img src={selectedEvent.imageUrl} alt="" className="w-full rounded-lg" />}
              <h3 className="text-lg font-bold text-gray-900">{selectedEvent.title}</h3>
              <p className="text-sm font-medium text-gray-700">{format(new Date(selectedEvent.startDate), 'EEEE, MMMM d, yyyy')}</p>
              {selectedEvent.location && <p className="text-sm text-gray-700">{selectedEvent.location}</p>}
              {selectedEvent.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedEvent.description}</p>}
            </div>
            <div className="p-4 border-t space-y-2 flex-shrink-0">
              {selectedEvent.url && (
                <a href={selectedEvent.url} target="_blank" rel="noopener noreferrer" className="block w-full py-3 bg-blue-600 text-white text-sm font-medium rounded-md text-center hover:bg-blue-700">View Original</a>
              )}
              <button onClick={() => { setEventToDelete(selectedEvent); setSelectedEvent(null); }} className="w-full py-2 px-4 bg-red-50 text-red-600 text-sm font-medium rounded-md hover:bg-red-100">Delete Event</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

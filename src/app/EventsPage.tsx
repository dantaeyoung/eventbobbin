'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Event, Source } from '@/lib/types';
import { EventList } from '@/components/EventList';
import { Calendar } from '@/components/Calendar';
import { TagFilter } from '@/components/TagFilter';
import { AppNav } from '@/components/TabNav';
import { DitheredBackground } from '@/components/DitheredBackground';
import { Tooltip } from '@/components/Tooltip';
import { api } from '@/lib/api';
import { fetchSquiggleSettings, setSquiggleSettingsCache, SquiggleSettings } from '@/lib/squiggleSettings';

const CITY_KEY = 'eventbobbin-city';
const SOURCES_KEY = 'eventbobbin-sources';
const TAGS_KEY = 'eventbobbin-tags';

interface EventsPageProps {
  initialEvents: Event[];
  initialSources: Source[];
}

function loadCity(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CITY_KEY);
}

function loadSources(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(SOURCES_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

function loadTags(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(TAGS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

// Generate a pastel color from a string
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


export function EventsPage({ initialEvents, initialSources }: EventsPageProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [allEvents, setAllEvents] = useState<Event[]>(initialEvents);
  const [sources] = useState<Source[]>(initialSources);
  const [squiggleSettings, setSquiggleSettings] = useState<SquiggleSettings>({});
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Get unique cities from sources
  const cities = useMemo(() => {
    const citySet = new Set<string>();
    sources.forEach((s) => {
      if (s.city) citySet.add(s.city);
    });
    return Array.from(citySet).sort();
  }, [sources]);

  // Filter sources by selected city
  const cityFilteredSources = useMemo(() => {
    if (!selectedCity) return sources;
    return sources.filter((s) => s.city === selectedCity);
  }, [sources, selectedCity]);

  // Get source IDs that match selected tags (within city-filtered sources)
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

  // City-filtered source IDs (base filter)
  const citySourceIds = useMemo(() => {
    if (!selectedCity) return null;
    return cityFilteredSources.map((s) => s.id);
  }, [selectedCity, cityFilteredSources]);

  // Effective source filter (combines city, manual selection, and tag selection)
  const effectiveSourceIds = useMemo(() => {
    // Start with city filter if set
    let baseIds = citySourceIds;

    // Apply tag filter
    if (sourceIdsWithSelectedTags) {
      baseIds = baseIds
        ? baseIds.filter((id) => sourceIdsWithSelectedTags.includes(id))
        : sourceIdsWithSelectedTags;
    }

    // Apply manual source selection
    if (selectedSources.length > 0) {
      baseIds = baseIds
        ? baseIds.filter((id) => selectedSources.includes(id))
        : selectedSources;
    }

    return baseIds;
  }, [selectedSources, sourceIdsWithSelectedTags, citySourceIds]);

  // Compute event dates for calendar dots (filtered by effective sources)
  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    const filtered = effectiveSourceIds
      ? allEvents.filter((e) => effectiveSourceIds.includes(e.sourceId))
      : allEvents;
    filtered.forEach((e) => {
      dates.add(e.startDate.split('T')[0]);
    });
    return dates;
  }, [allEvents, effectiveSourceIds]);

  // Load saved filters from localStorage on mount
  useEffect(() => {
    setSelectedCity(loadCity());
    setSelectedSources(loadSources());
    setSelectedTags(loadTags());
    setMounted(true);
    // Fetch all future events for calendar dots
    api.getEvents({ from: format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss") })
      .then(setAllEvents)
      .catch(console.error);
    // Load squiggle settings
    fetchSquiggleSettings().then((settings) => {
      setSquiggleSettingsCache(settings);
      setSquiggleSettings(settings);
    });
  }, []);

  // Save city to localStorage when it changes
  useEffect(() => {
    if (mounted) {
      if (selectedCity) {
        localStorage.setItem(CITY_KEY, selectedCity);
      } else {
        localStorage.removeItem(CITY_KEY);
      }
    }
  }, [selectedCity, mounted]);

  // Save sources to localStorage when they change
  useEffect(() => {
    if (mounted) {
      if (selectedSources.length > 0) {
        localStorage.setItem(SOURCES_KEY, JSON.stringify(selectedSources));
      } else {
        localStorage.removeItem(SOURCES_KEY);
      }
    }
  }, [selectedSources, mounted]);

  // Save tags to localStorage when they change
  useEffect(() => {
    if (mounted) {
      if (selectedTags.length > 0) {
        localStorage.setItem(TAGS_KEY, JSON.stringify(selectedTags));
      } else {
        localStorage.removeItem(TAGS_KEY);
      }
    }
  }, [selectedTags, mounted]);

  const handleCalendarSelect = (date: Date | null) => {
    setSelectedDate(date);
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      if (effectiveSourceIds && effectiveSourceIds.length === 0) {
        // No sources match the filters, don't fetch
        setEvents([]);
        setLoading(false);
        return;
      }

      let from: string | undefined;
      let to: string | undefined;

      if (selectedDate) {
        // Calendar date selected - show just that day (using local timezone)
        from = startOfDay(selectedDate).toISOString();
        to = endOfDay(selectedDate).toISOString();
      } else {
        // Show all future events from today onwards
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
  }, [effectiveSourceIds, selectedDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

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
    <div className="h-screen flex flex-col overflow-hidden">
      <DitheredBackground />
      <header className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-end justify-between pt-3">
            <div className="flex items-end gap-4">
              <h1 className="text-xl font-bold text-gray-900 pb-2">EventBobbin</h1>
              <AppNav />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <button
                onClick={() => setShowHelp(true)}
                className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-medium"
                title="About EventBobbin"
              >
                ?
              </button>
              <a
                href="/api/calendar.ics"
                className="text-sm text-gray-600 hover:text-gray-900 hidden md:inline"
                title="Subscribe to calendar feed"
              >
                📅
              </a>
            </div>
          </div>
        </div>
      </header>

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
          {loading && (
            <span className="text-sm text-gray-500">Loading...</span>
          )}
        </div>

        <div className="flex gap-6 h-full">
          {/* Left: Calendar and Sources - hidden on mobile */}
          <div className="hidden md:flex md:flex-col flex-shrink-0 w-[280px] h-full px-5">
            {/* Fixed section: Calendar and City */}
            <div className="flex-shrink-0">
              <div className="flex justify-center">
                <Calendar
                  selectedDate={selectedDate}
                  onSelectDate={handleCalendarSelect}
                  eventDates={eventDates}
                />
              </div>

              {/* City Filter */}
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
                      <span className="text-xs">✱</span>
                      All
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

            {/* Scrollable section: Sources List */}
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
                  <span className="text-xs">✱</span>
                  All Sources
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
                    <div
                      className="w-4 h-4 flex-shrink-0 rounded overflow-hidden"
                      style={{ backgroundColor: source.logoUrl ? undefined : stringToPastelColor(source.name) }}
                    >
                      {source.logoUrl && (
                        <img
                          src={source.logoUrl}
                          alt=""
                          className="w-full h-full object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <span className="truncate">{source.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Filters and Events */}
          <div className="flex-1 min-w-0 flex flex-col h-full relative">
            {/* Loading overlay */}
            {loading && (
              <div className="absolute top-0 right-0 text-sm text-gray-500 z-10">Loading...</div>
            )}
            <div className="space-y-4 mb-6 flex-shrink-0">
              {selectedDate && (
                <div className="text-sm text-gray-600">
                  Showing events for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </div>
              )}
              <div className="hidden md:block">
                <TagFilter
                  sources={cityFilteredSources}
                  selected={selectedTags}
                  onChange={setSelectedTags}
                />
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

          {/* Right: Event Detail Panel - Fixed position */}
          {selectedEvent && (
            <div className="hidden md:flex flex-col fixed right-0 top-[57px] bottom-0 w-[350px] bg-white border-l border-gray-200 z-40">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="font-bold text-gray-900">Event Details</h2>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Event Image */}
                {selectedEvent.imageUrl && (
                  <img
                    src={selectedEvent.imageUrl}
                    alt=""
                    className="w-full rounded-lg"
                    style={{ height: 'auto', maxWidth: '100%' }}
                  />
                )}

                {/* Title */}
                <h3 className="text-lg font-bold text-gray-900">{selectedEvent.title}</h3>

                {/* Date & Time */}
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">
                    {format(new Date(selectedEvent.startDate), 'EEEE, MMMM d, yyyy')}
                  </p>
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

                {/* Location */}
                {selectedEvent.location && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Location</p>
                    <p className="text-sm text-gray-700">{selectedEvent.location}</p>
                  </div>
                )}

                {/* Description */}
                {selectedEvent.description && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedEvent.description}</p>
                  </div>
                )}

                {/* Source */}
                {(() => {
                  const eventSource = sources.find(s => s.id === selectedEvent.sourceId);
                  return eventSource && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Source</p>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded overflow-hidden flex-shrink-0"
                          style={{ backgroundColor: eventSource.logoUrl ? undefined : stringToPastelColor(eventSource.name) }}
                        >
                          {eventSource.logoUrl && (
                            <img src={eventSource.logoUrl} alt="" className="w-full h-full object-contain" />
                          )}
                        </div>
                        <span className="text-sm text-gray-700">{eventSource.name}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <div className="flex gap-2">
                    {selectedEvent.url && (
                      <a
                        href={selectedEvent.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-md text-center hover:bg-blue-700"
                      >
                        View Original
                      </a>
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
                    <a
                      href={`/api/events/${selectedEvent.id}/ics`}
                      className="py-2 px-4 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
                    >
                      📅 .ics
                    </a>
                  </div>
                  <button
                    onClick={() => {
                      setEventToDelete(selectedEvent);
                      setSelectedEvent(null);
                    }}
                    className="w-full py-2 px-4 bg-red-50 text-red-600 text-sm font-medium rounded-md hover:bg-red-100"
                  >
                    Delete Event
                  </button>
                </div>

                {/* Raw Data (collapsed by default) */}
                {selectedEvent.rawData && (
                  <details className="mt-4">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      View Raw Scraped Data
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                      {typeof selectedEvent.rawData === 'string'
                        ? selectedEvent.rawData
                        : JSON.stringify(selectedEvent.rawData, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Remove Event?</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to remove "{eventToDelete.title}"? This won't affect the source website.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setEventToDelete(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                className="flex-1 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">About EventBobbin</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <p>
                <strong>EventBobbin</strong> aggregates events from multiple websites into one place.
              </p>
              <p>
                <strong>How it works:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Add event sources (websites with event listings)</li>
                <li>Click "Scrape Now" to extract events using AI</li>
                <li>Events appear here, filterable by date and source</li>
              </ol>
              <p>
                <strong>Tips:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Blue dots on calendar = dates with events</li>
                <li>Click a calendar date to filter to that day</li>
                <li>Hold Shift + click "Scrape Now" to force re-scrape</li>
                <li>Scraping auto-skips if page hasn't changed</li>
              </ul>
              <p>
                <strong>Calendar Subscription:</strong>
              </p>
              <p className="ml-2">
                Click "📅 Subscribe" to get a calendar feed URL. Add it to Google Calendar or Apple Calendar and events will sync automatically.
              </p>
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/calendar.ics` : '/api/calendar.ics'}
              </div>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-4 w-full py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Mobile Filters Modal */}
      {showMobileFilters && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50 md:hidden">
          <div className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Filters</h2>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* City Filter */}
              {cities.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">City</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCity(null)}
                      className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1 italic ${
                        selectedCity === null
                          ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white'
                          : 'text-gray-500 border border-dashed border-gray-300'
                      }`}
                    >
                      <span className="text-xs">✱</span>
                      All
                    </button>
                    {cities.map((city) => (
                      <button
                        key={city}
                        onClick={() => setSelectedCity(city)}
                        className={`px-3 py-1.5 text-sm rounded-md border ${
                          selectedCity === city
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-gray-100 text-gray-700 border-gray-100'
                        }`}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tag Filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
                <TagFilter
                  sources={cityFilteredSources}
                  selected={selectedTags}
                  onChange={setSelectedTags}
                />
              </div>

              {/* Sources */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Sources</h3>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => setSelectedSources([])}
                    className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 italic ${
                      selectedSources.length === 0
                        ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white'
                        : 'bg-gray-50 text-gray-500 border border-dashed border-gray-300'
                    }`}
                  >
                    <span className="text-xs">✱</span>
                    All Sources
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
                        selectedSources.includes(source.id)
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div
                        className="w-5 h-5 flex-shrink-0 rounded overflow-hidden"
                        style={{ backgroundColor: source.logoUrl ? undefined : stringToPastelColor(source.name) }}
                      >
                        {source.logoUrl && (
                          <img
                            src={source.logoUrl}
                            alt=""
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <span className="truncate">{source.name}</span>
                      {source.city && (
                        <span className="ml-auto text-xs opacity-60">{source.city}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Apply Button */}
            <div className="p-4 border-t">
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-full py-3 bg-gray-900 text-white rounded-md font-medium"
              >
                Apply Filters
              </button>
              {(selectedCity || selectedSources.length > 0 || selectedTags.length > 0) && (
                <button
                  onClick={() => {
                    setSelectedCity(null);
                    setSelectedSources([]);
                    setSelectedTags([]);
                  }}
                  className="w-full mt-2 py-2 text-gray-600 text-sm"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50 md:hidden">
          <div className="bg-white rounded-t-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Event Details</h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Event Image */}
              {selectedEvent.imageUrl && (
                <img
                  src={selectedEvent.imageUrl}
                  alt=""
                  className="w-full rounded-lg"
                  style={{ height: 'auto', maxWidth: '100%' }}
                />
              )}

              {/* Title */}
              <h3 className="text-lg font-bold text-gray-900">{selectedEvent.title}</h3>

              {/* Date & Time */}
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700">
                  {format(new Date(selectedEvent.startDate), 'EEEE, MMMM d, yyyy')}
                </p>
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

              {/* Location */}
              {selectedEvent.location && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Location</p>
                  <p className="text-sm text-gray-700">{selectedEvent.location}</p>
                </div>
              )}

              {/* Description */}
              {selectedEvent.description && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedEvent.description}</p>
                </div>
              )}

              {/* Source */}
              {(() => {
                const eventSource = sources.find(s => s.id === selectedEvent.sourceId);
                return eventSource && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Source</p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded overflow-hidden flex-shrink-0"
                        style={{ backgroundColor: eventSource.logoUrl ? undefined : stringToPastelColor(eventSource.name) }}
                      >
                        {eventSource.logoUrl && (
                          <img src={eventSource.logoUrl} alt="" className="w-full h-full object-contain" />
                        )}
                      </div>
                      <span className="text-sm text-gray-700">{eventSource.name}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Raw Data (collapsed by default) */}
              {selectedEvent.rawData && (
                <details className="mt-4">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    View Raw Scraped Data
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                    {typeof selectedEvent.rawData === 'string'
                      ? selectedEvent.rawData
                      : JSON.stringify(selectedEvent.rawData, null, 2)}
                  </pre>
                </details>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t space-y-2 flex-shrink-0">
              {selectedEvent.url && (
                <a
                  href={selectedEvent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 bg-blue-600 text-white text-sm font-medium rounded-md text-center hover:bg-blue-700"
                >
                  View Original
                </a>
              )}
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
                  Google Calendar
                </a>
                <a
                  href={`/api/events/${selectedEvent.id}/ics`}
                  className="py-2 px-4 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
                >
                  📅
                </a>
              </div>
              <button
                onClick={() => {
                  setEventToDelete(selectedEvent);
                  setSelectedEvent(null);
                }}
                className="w-full py-2 px-4 bg-red-50 text-red-600 text-sm font-medium rounded-md hover:bg-red-100"
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

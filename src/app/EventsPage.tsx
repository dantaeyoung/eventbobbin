'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfDay, endOfDay, endOfWeek, addDays, startOfWeek } from 'date-fns';
import { Event, Source } from '@/lib/types';
import { EventList } from '@/components/EventList';
import { DateFilter, DateRange } from '@/components/DateFilter';
import { Calendar } from '@/components/Calendar';
import { TagFilter } from '@/components/TagFilter';
import { api } from '@/lib/api';
import { fetchSquiggleSettings, setSquiggleSettingsCache, SquiggleSettings } from '@/lib/squiggleSettings';

const DATE_RANGE_KEY = 'eventbobbin-daterange';
const CITY_KEY = 'eventbobbin-city';

interface EventsPageProps {
  initialEvents: Event[];
  initialSources: Source[];
}

function getDateRange(range: DateRange): { from: string; to: string } {
  const now = new Date();
  switch (range) {
    case 'today':
      return {
        from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        to: format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    case 'tomorrow':
      const tomorrow = addDays(now, 1);
      return {
        from: format(startOfDay(tomorrow), "yyyy-MM-dd'T'HH:mm:ss"),
        to: format(endOfDay(tomorrow), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    case 'week':
      return {
        from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        to: format(endOfWeek(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    case 'nextweek':
      const nextWeekStart = startOfWeek(addDays(now, 7));
      const nextWeekEnd = endOfWeek(nextWeekStart);
      return {
        from: format(startOfDay(nextWeekStart), "yyyy-MM-dd'T'HH:mm:ss"),
        to: format(endOfDay(nextWeekEnd), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    case 'all':
      return {
        from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        to: '',
      };
  }
}

function loadDateRange(): DateRange {
  if (typeof window === 'undefined') return 'week';
  const stored = localStorage.getItem(DATE_RANGE_KEY);
  if (stored && ['today', 'tomorrow', 'week', 'nextweek', 'all'].includes(stored)) {
    return stored as DateRange;
  }
  return 'week';
}

function loadCity(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CITY_KEY);
}


export function EventsPage({ initialEvents, initialSources }: EventsPageProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [allEvents, setAllEvents] = useState<Event[]>(initialEvents);
  const [sources] = useState<Source[]>(initialSources);
  const [squiggleSettings, setSquiggleSettings] = useState<SquiggleSettings>({});
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | null>('week');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

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

  // Load date range and city from localStorage on mount
  useEffect(() => {
    setDateRange(loadDateRange());
    setSelectedCity(loadCity());
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

  // Save date range to localStorage when it changes
  useEffect(() => {
    if (mounted && dateRange) {
      localStorage.setItem(DATE_RANGE_KEY, dateRange);
    }
  }, [dateRange, mounted]);


  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    setSelectedDate(null); // Clear calendar selection
  };

  const handleCalendarSelect = (date: Date | null) => {
    setSelectedDate(date);
    if (date) {
      setDateRange(null); // Deselect date range buttons when calendar date selected
    }
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
        // Calendar date selected - show just that day
        from = format(startOfDay(selectedDate), "yyyy-MM-dd'T'HH:mm:ss");
        to = format(endOfDay(selectedDate), "yyyy-MM-dd'T'HH:mm:ss");
      } else if (dateRange) {
        // Use date range filter
        const range = getDateRange(dateRange);
        from = range.from || undefined;
        to = range.to || undefined;
      } else {
        // No filter - show from today onwards
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
  }, [effectiveSourceIds, dateRange, selectedDate]);

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
    <div className="h-screen flex flex-col bg-[#FFF8F0] overflow-hidden">
      <header className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">EventBobbin</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHelp(true)}
                className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-medium"
                title="About EventBobbin"
              >
                ?
              </button>
              <a
                href="/api/calendar.ics"
                className="text-sm text-gray-600 hover:text-gray-900"
                title="Subscribe to calendar feed"
              >
                📅 Subscribe
              </a>
              <a
                href="/squiggles"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Squiggles
              </a>
              <a
                href="/sources"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sources
              </a>
              <a
                href="/stats"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Stats
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-6xl mx-auto px-4 py-6 w-full">
        <div className="flex gap-6 h-full">
          {/* Left: Calendar and Sources */}
          <div className="flex-shrink-0 w-[220px] overflow-y-auto">
            {/* City Filter */}
            {cities.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">City</h3>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setSelectedCity(null)}
                    className={`px-3 py-1 text-sm rounded-md ${
                      selectedCity === null
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {cities.map((city) => (
                    <button
                      key={city}
                      onClick={() => setSelectedCity(city)}
                      className={`px-3 py-1 text-sm rounded-md ${
                        selectedCity === city
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Calendar
              selectedDate={selectedDate}
              onSelectDate={handleCalendarSelect}
              eventDates={eventDates}
            />

            {/* Sources List */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Sources</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedSources([])}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                    selectedSources.length === 0
                      ? 'bg-gray-900 text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
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
                    <div className="w-4 h-4 flex-shrink-0 bg-gray-200 rounded overflow-hidden">
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
          <div className="flex-1 min-w-0 flex flex-col h-full">
            <div className="space-y-4 mb-6 flex-shrink-0">
              <div className="flex items-center justify-between">
                <DateFilter
                  selected={dateRange}
                  onChange={handleDateRangeChange}
                />
                {loading && (
                  <span className="text-sm text-gray-500">Loading...</span>
                )}
              </div>
              {selectedDate && (
                <div className="text-sm text-gray-600">
                  Showing events for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </div>
              )}
              <TagFilter
                sources={cityFilteredSources}
                selected={selectedTags}
                onChange={setSelectedTags}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              <EventList events={events} sources={sources} onDeleteEvent={setEventToDelete} squiggleSettings={squiggleSettings} />
            </div>
          </div>
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
    </div>
  );
}

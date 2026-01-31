'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfDay, endOfDay, endOfWeek, addDays, startOfWeek } from 'date-fns';
import { Event, Source } from '@/lib/types';
import { EventList } from '@/components/EventList';
import { SourceFilter } from '@/components/SourceFilter';
import { DateFilter, DateRange } from '@/components/DateFilter';
import { Calendar } from '@/components/Calendar';

const DATE_RANGE_KEY = 'eventbobbin-daterange';

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

export function EventsPage({ initialEvents, initialSources }: EventsPageProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [allEvents, setAllEvents] = useState<Event[]>(initialEvents);
  const [sources] = useState<Source[]>(initialSources);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | null>('week');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  // Compute event dates for calendar dots (filtered by selected sources)
  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    const filtered = selectedSources.length > 0
      ? allEvents.filter((e) => selectedSources.includes(e.sourceId))
      : allEvents;
    filtered.forEach((e) => {
      dates.add(e.startDate.split('T')[0]);
    });
    return dates;
  }, [allEvents, selectedSources]);

  // Load date range from localStorage on mount
  useEffect(() => {
    setDateRange(loadDateRange());
    setMounted(true);
    // Fetch all future events for calendar dots
    fetch('/api/events?from=' + format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss"))
      .then((r) => r.json())
      .then(setAllEvents);
  }, []);

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
      const params = new URLSearchParams();
      if (selectedSources.length > 0) {
        params.set('sources', selectedSources.join(','));
      }

      if (selectedDate) {
        // Calendar date selected - show just that day
        params.set('from', format(startOfDay(selectedDate), "yyyy-MM-dd'T'HH:mm:ss"));
        params.set('to', format(endOfDay(selectedDate), "yyyy-MM-dd'T'HH:mm:ss"));
      } else if (dateRange) {
        // Use date range filter
        const range = getDateRange(dateRange);
        if (range.from) params.set('from', range.from);
        if (range.to) params.set('to', range.to);
      } else {
        // No filter - show from today onwards
        params.set('from', format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss"));
      }

      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, [selectedSources, dateRange, selectedDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    const res = await fetch(`/api/events/${eventToDelete.id}`, { method: 'DELETE' });
    if (res.ok) {
      setEvents(events.filter((e) => e.id !== eventToDelete.id));
      setAllEvents(allEvents.filter((e) => e.id !== eventToDelete.id));
    }
    setEventToDelete(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
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
                href="/sources"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Manage Sources
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left: Calendar */}
          <div className="flex-shrink-0">
            <Calendar
              selectedDate={selectedDate}
              onSelectDate={handleCalendarSelect}
              eventDates={eventDates}
            />
          </div>

          {/* Right: Filters and Events */}
          <div className="flex-1 min-w-0">
            <div className="space-y-4 mb-6">
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
              <SourceFilter
                sources={sources}
                selected={selectedSources}
                onChange={setSelectedSources}
              />
            </div>

            <EventList events={events} sources={sources} onDeleteEvent={setEventToDelete} />
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Event, Source } from '@/lib/types';
import { EventList } from '@/components/EventList';
import { SourceFilter } from '@/components/SourceFilter';
import { DateFilter, DateRange } from '@/components/DateFilter';

interface EventsPageProps {
  initialEvents: Event[];
  initialSources: Source[];
}

function getDateRange(range: DateRange): { from: string; to: string } | null {
  const now = new Date();
  switch (range) {
    case 'today':
      return {
        from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        to: format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    case 'week':
      return {
        from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        to: format(endOfWeek(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    case 'month':
      return {
        from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        to: format(endOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    case 'all':
      return {
        from: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        to: '',
      };
  }
}

export function EventsPage({ initialEvents, initialSources }: EventsPageProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [sources] = useState<Source[]>(initialSources);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSources.length > 0) {
        params.set('sources', selectedSources.join(','));
      }
      const range = getDateRange(dateRange);
      if (range) {
        if (range.from) params.set('from', range.from);
        if (range.to) params.set('to', range.to);
      }

      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, [selectedSources, dateRange]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">EventBobbin</h1>
            <a
              href="/sources"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Manage Sources
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <DateFilter selected={dateRange} onChange={setDateRange} />
            {loading && (
              <span className="text-sm text-gray-500">Loading...</span>
            )}
          </div>
          <SourceFilter
            sources={sources}
            selected={selectedSources}
            onChange={setSelectedSources}
          />
        </div>

        <EventList events={events} sources={sources} />
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, startOfDay } from 'date-fns';
import { Source, Event } from '@/lib/types';
import { api } from '@/lib/api';
import { AppNav } from '@/components/TabNav';
import { DitheredBackground } from '@/components/DitheredBackground';
import { getStoredSchemeId, getSchemeById, applyColorScheme } from '@/lib/colorSchemes';

// Import tab content components
import { EventsTab } from './tabs/EventsTab';
import { SourcesTab } from './tabs/SourcesTab';
import { SquigglesTab } from './tabs/SquigglesTab';
import { ColorsTab } from './tabs/ColorsTab';
import { StatsTab } from './tabs/StatsTab';

export type TabId = 'events' | 'sources' | 'squiggles' | 'colors' | 'stats';

// Map URL paths to tab IDs
const PATH_TO_TAB: Record<string, TabId> = {
  '/': 'events',
  '/sources': 'sources',
  '/squiggles': 'squiggles',
  '/colors': 'colors',
  '/stats': 'stats',
};

const TAB_TO_PATH: Record<TabId, string> = {
  events: '/',
  sources: '/sources',
  squiggles: '/squiggles',
  colors: '/colors',
  stats: '/stats',
};

export function App() {
  // Shared state
  const [sources, setSources] = useState<Source[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Current tab
  const [activeTab, setActiveTab] = useState<TabId>('events');

  // Initialize tab from URL and color scheme on mount
  useEffect(() => {
    const path = window.location.pathname;
    const tab = PATH_TO_TAB[path] || 'events';
    setActiveTab(tab);

    // Apply stored color scheme
    const schemeId = getStoredSchemeId();
    const scheme = getSchemeById(schemeId);
    applyColorScheme(scheme);

    setMounted(true);

    // Fetch initial data
    Promise.all([
      api.getSources(),
      api.getEvents({ from: format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss") }),
    ]).then(([sourcesData, eventsData]) => {
      setSources(sourcesData);
      setAllEvents(eventsData);
      setEvents(eventsData);
      setLoading(false);
    }).catch(console.error);

    // Handle browser back/forward
    const handlePopState = () => {
      const path = window.location.pathname;
      const tab = PATH_TO_TAB[path] || 'events';
      setActiveTab(tab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigate to tab
  const navigateToTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
    const path = TAB_TO_PATH[tab];
    window.history.pushState({}, '', path);
  }, []);

  // Refresh sources (called after scraping, etc.)
  const refreshSources = useCallback(async () => {
    try {
      const data = await api.getSources();
      setSources(data);
    } catch (e) {
      console.error('Failed to refresh sources:', e);
    }
  }, []);

  // Refresh events
  const refreshEvents = useCallback(async () => {
    try {
      const data = await api.getEvents({ from: format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss") });
      setAllEvents(data);
    } catch (e) {
      console.error('Failed to refresh events:', e);
    }
  }, []);

  // Loading state
  if (!mounted) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <DitheredBackground />
        <header className="border-b flex-shrink-0" style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-card-stroke)' }}>
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-end justify-between pt-3">
              <div className="flex items-end gap-4">
                <h1 className="text-xl font-bold pb-2" style={{ color: 'var(--color-text)' }}>EventBobbin</h1>
                <AppNav onNavigate={navigateToTab} activeTab={activeTab} />
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-gray-400">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <DitheredBackground />
      <header className="border-b flex-shrink-0" style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-card-stroke)' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-end justify-between pt-3">
            <div className="flex items-end gap-4">
              <h1 className="text-xl font-bold pb-2" style={{ color: 'var(--color-text)' }}>EventBobbin</h1>
              <AppNav onNavigate={navigateToTab} activeTab={activeTab} />
            </div>
          </div>
        </div>
      </header>

      {/* Tab content */}
      {activeTab === 'events' && (
        <EventsTab
          sources={sources}
          events={events}
          setEvents={setEvents}
          allEvents={allEvents}
          setAllEvents={setAllEvents}
          loading={loading}
        />
      )}
      {activeTab === 'sources' && (
        <SourcesTab
          sources={sources}
          setSources={setSources}
          refreshSources={refreshSources}
        />
      )}
      {activeTab === 'squiggles' && (
        <SquigglesTab sources={sources} />
      )}
      {activeTab === 'colors' && (
        <ColorsTab />
      )}
      {activeTab === 'stats' && (
        <StatsTab sources={sources} />
      )}
    </div>
  );
}

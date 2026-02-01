export interface Source {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastScrapedAt: string | null;
  lastContentHash: string | null;
  scrapeIntervalHours: number;
  scrapeInstructions: string | null; // e.g., "Only extract NYC events"
  scrapingStartedAt: string | null; // null = not scraping, timestamp = in progress
  tags: string | null; // comma-separated, e.g., "museum,art,movement"
  logoUrl: string | null; // URL to the source's logo
  city: string | null; // e.g., "NYC", "LA"
  createdAt: string;
  eventCount?: number; // Number of events from this source
}

export interface Event {
  id: string;
  sourceId: string;
  title: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  rawData: string;
  createdAt: string;
  updatedAt: string;
  scrapedAt: string;
}

export interface ExtractedEvent {
  title: string;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  imageUrl?: string | null;
}

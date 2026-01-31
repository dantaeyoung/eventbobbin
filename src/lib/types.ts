export interface Source {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastScrapedAt: string | null;
  lastContentHash: string | null;
  scrapeIntervalHours: number;
  createdAt: string;
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
}

import { StatsPage } from './StatsPage';

export const dynamic = 'force-dynamic';

const emptyStats = {
  llm: {
    totalCalls: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    recentUsage: [],
  },
  events: {
    totalEvents: 0,
    totalSources: 0,
    enabledSources: 0,
    eventsThisMonth: 0,
  },
};

async function getData() {
  const baseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/stats`, { cache: 'no-store' });
    if (!res.ok) {
      console.error('Stats API error:', res.status);
      return emptyStats;
    }
    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      console.error('Stats API returned non-JSON:', contentType);
      return emptyStats;
    }
    return res.json();
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return emptyStats;
  }
}

export default async function Stats() {
  const stats = await getData();
  return <StatsPage initialStats={stats} />;
}

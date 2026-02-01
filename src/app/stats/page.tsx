import { StatsPage } from './StatsPage';
import { getLLMStats, getEventStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getData() {
  try {
    const [llmStats, eventStats] = await Promise.all([
      getLLMStats(),
      getEventStats(),
    ]);
    return { llm: llmStats, events: eventStats };
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return {
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
  }
}

export default async function Stats() {
  const stats = await getData();
  return <StatsPage initialStats={stats} />;
}

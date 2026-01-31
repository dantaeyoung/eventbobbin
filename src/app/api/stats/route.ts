import { NextResponse } from 'next/server';
import { getLLMStats, getEventStats } from '@/lib/db';

export async function GET() {
  try {
    const llmStats = getLLMStats();
    const eventStats = getEventStats();

    return NextResponse.json({
      llm: llmStats,
      events: eventStats,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({
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
    });
  }
}

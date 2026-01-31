import { NextResponse } from 'next/server';
import { getLLMStats, getEventStats } from '@/lib/db';

export async function GET() {
  const llmStats = getLLMStats();
  const eventStats = getEventStats();

  return NextResponse.json({
    llm: llmStats,
    events: eventStats,
  });
}

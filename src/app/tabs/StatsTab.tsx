'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Source } from '@/lib/types';

interface LLMUsage {
  id: number;
  sourceId: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  createdAt: string;
}

interface Stats {
  llm: {
    totalCalls: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCost: number;
    recentUsage: LLMUsage[];
  };
  events: {
    totalEvents: number;
    totalSources: number;
    enabledSources: number;
    eventsThisMonth: number;
  };
}

interface StatsTabProps {
  sources: Source[];
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${(cost * 100).toFixed(3)}¢`;
  return `$${cost.toFixed(4)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function StatsTab({ sources }: StatsTabProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch stats:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Loading stats...</div>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Failed to load stats</div>
      </main>
    );
  }

  const { llm, events } = stats;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Event Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Event Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{formatNumber(events.totalEvents)}</div>
              <div className="text-sm text-gray-500">Total Events</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{formatNumber(events.eventsThisMonth)}</div>
              <div className="text-sm text-gray-500">Events This Month</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{events.totalSources}</div>
              <div className="text-sm text-gray-500">Total Sources</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{events.enabledSources}</div>
              <div className="text-sm text-gray-500">Enabled Sources</div>
            </div>
          </div>
        </div>

        {/* LLM Usage Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">LLM Usage (GPT-4o-mini)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">{formatNumber(llm.totalCalls)}</div>
              <div className="text-sm text-blue-600">Total API Calls</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">{formatNumber(llm.totalTokens)}</div>
              <div className="text-sm text-blue-600">Total Tokens</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-900">{formatCost(llm.totalCost)}</div>
              <div className="text-sm text-green-600">Total Cost</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-900">{llm.totalCalls > 0 ? formatCost(llm.totalCost / llm.totalCalls) : '$0'}</div>
              <div className="text-sm text-gray-500">Avg Cost/Call</div>
            </div>
          </div>

          <div className="text-sm text-gray-500 mb-2">
            Input: {formatNumber(llm.totalPromptTokens)} tokens | Output: {formatNumber(llm.totalCompletionTokens)} tokens
          </div>

          {llm.recentUsage.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Recent API Calls</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-gray-500 font-medium">Time</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Input</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Output</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {llm.recentUsage.map((usage) => (
                      <tr key={usage.id} className="border-b border-gray-100">
                        <td className="py-2 text-gray-600">{format(new Date(usage.createdAt), 'MMM d, h:mm a')}</td>
                        <td className="py-2 text-right text-gray-600">{formatNumber(usage.promptTokens)}</td>
                        <td className="py-2 text-right text-gray-600">{formatNumber(usage.completionTokens)}</td>
                        <td className="py-2 text-right text-gray-900 font-medium">{formatCost(usage.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {llm.totalCalls === 0 && (
            <div className="text-center py-8 text-gray-400">No LLM usage recorded yet. Scrape a source to start tracking!</div>
          )}
        </div>

        {/* Pricing Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Pricing Reference</h2>
          <p className="text-sm text-gray-500">GPT-4o-mini: $0.15 per 1M input tokens, $0.60 per 1M output tokens</p>
          <p className="text-sm text-gray-400 mt-1">Typical scrape uses ~2-4K input tokens and ~500-1K output tokens (~$0.001 per scrape)</p>
        </div>
      </div>
    </main>
  );
}

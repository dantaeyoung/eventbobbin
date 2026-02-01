import OpenAI from 'openai';
import { ExtractedEvent } from '../types';
import { buildExtractionPrompt } from './prompt';
import { recordLLMUsage } from '../db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GPT-4o-mini pricing (as of 2024): $0.15 per 1M input tokens, $0.60 per 1M output tokens
const PRICING = {
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
};

export async function extractEvents(
  pageText: string,
  links: { text: string; href: string }[],
  scrapeInstructions?: string | null,
  sourceId?: string
): Promise<ExtractedEvent[]> {
  const currentDate = new Date().toISOString().split('T')[0];
  const prompt = buildExtractionPrompt(pageText, links, currentDate, scrapeInstructions);
  const model = 'gpt-4o-mini';

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0,
    max_tokens: 4000,
  });

  // Track usage
  const usage = response.usage;
  if (usage) {
    const pricing = PRICING[model as keyof typeof PRICING] || { input: 0, output: 0 };
    const cost = (usage.prompt_tokens * pricing.input) + (usage.completion_tokens * pricing.output);
    await recordLLMUsage({
      sourceId: sourceId || null,
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      cost,
    });
  }

  const content = response.choices[0]?.message?.content || '[]';

  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const events = JSON.parse(jsonStr) as ExtractedEvent[];

    // Validate and filter
    return events.filter((e) => {
      if (!e.title || !e.startDate) return false;
      // Basic ISO date validation
      if (!/^\d{4}-\d{2}-\d{2}/.test(e.startDate)) return false;
      return true;
    });
  } catch (error) {
    console.error('Failed to parse LLM response:', content);
    return [];
  }
}

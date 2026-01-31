import OpenAI from 'openai';
import { ExtractedEvent } from '../types';
import { buildExtractionPrompt } from './prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractEvents(
  pageText: string,
  links: { text: string; href: string }[],
  scrapeInstructions?: string | null
): Promise<ExtractedEvent[]> {
  const currentDate = new Date().toISOString().split('T')[0];
  const prompt = buildExtractionPrompt(pageText, links, currentDate, scrapeInstructions);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0,
    max_tokens: 4000,
  });

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

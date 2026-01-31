import { SourcesPage } from './SourcesPage';
import { Source } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getData() {
  const baseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/sources`, { cache: 'no-store' });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text || !text.startsWith('[')) {
      console.error('Sources API returned non-JSON:', text.slice(0, 100));
      return [];
    }
    return JSON.parse(text) as Source[];
  } catch (error) {
    console.error('Failed to fetch sources:', error);
    return [];
  }
}

export default async function Sources() {
  const sources = await getData();
  return <SourcesPage initialSources={sources} />;
}

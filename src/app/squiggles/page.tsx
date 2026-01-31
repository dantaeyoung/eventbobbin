import { SquigglesPage } from './SquigglesPage';
import { Source } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getData() {
  const baseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/sources`, { cache: 'no-store' });
  const sources: Source[] = await res.json();
  return sources;
}

export default async function Squiggles() {
  const sources = await getData();
  return <SquigglesPage initialSources={sources} />;
}

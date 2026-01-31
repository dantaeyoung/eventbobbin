import { StatsPage } from './StatsPage';

export const dynamic = 'force-dynamic';

async function getData() {
  const baseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/stats`, { cache: 'no-store' });
  return res.json();
}

export default async function Stats() {
  const stats = await getData();
  return <StatsPage initialStats={stats} />;
}

import { SquigglesPage } from './SquigglesPage';
import { getAllSources } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Squiggles() {
  const sources = await getAllSources();
  return <SquigglesPage initialSources={sources} />;
}

import { SourcesPage } from './SourcesPage';
import { getAllSources } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Sources() {
  const sources = await getAllSources();
  return <SourcesPage initialSources={sources} />;
}

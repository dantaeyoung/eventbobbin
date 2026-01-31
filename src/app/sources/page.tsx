import { getAllSources } from '@/lib/db';
import { SourcesPage } from './SourcesPage';

export const dynamic = 'force-dynamic';

export default function Sources() {
  const sources = getAllSources();
  return <SourcesPage initialSources={sources} />;
}

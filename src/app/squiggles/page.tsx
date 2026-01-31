import { getAllSources } from '@/lib/db';
import { SquigglesPage } from './SquigglesPage';

export default function Page() {
  const sources = getAllSources();
  return <SquigglesPage initialSources={sources} />;
}

import BlockCard from '../components/BlockCard.jsx';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import Loader from '../components/Loader.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import useFetch from '../hooks/useFetch.js';
import { fetchBlocks } from '../services/api.js';

export default function BlocksPage() {
  const { data: blocks, loading, error, reload } = useFetch(fetchBlocks, []);

  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Blocks' }]} />
      <h1 className="page-title">Blocks</h1>

      {loading && !blocks && <Loader text="Loading blocks..." />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {blocks && blocks.length === 0 && <EmptyState title="No blocks found." />}
      {blocks && (
        <div className="grid grid-blocks">
          {blocks.map((block, index) => (
            <BlockCard key={block._id} block={block} index={index} />
          ))}
        </div>
      )}
    </>
  );
}

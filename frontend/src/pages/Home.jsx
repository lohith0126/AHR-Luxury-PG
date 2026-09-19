import Logo from '../components/Logo.jsx';
import BlockCard from '../components/BlockCard.jsx';
import Loader from '../components/Loader.jsx';
import ErrorState from '../components/ErrorState.jsx';
import useFetch from '../hooks/useFetch.js';
import { fetchBlocks, fetchDashboard } from '../services/api.js';

export default function Home() {
  const { data, loading, error, reload } = useFetch(async () => {
    const [stats, blocks] = await Promise.all([fetchDashboard(), fetchBlocks()]);
    return { stats, blocks };
  }, []);

  const stats = data?.stats;

  return (
    <>
      <section className="hero">
        <Logo size={64} />
        <h1>AHR LUXURY GENTS PG</h1>
        <p className="hero-sub">
          More Than a Stay
          <br />A Better Tomorrow
        </p>
      </section>

      {loading && !data && <Loader text="Loading dashboard..." />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <section className="stats-grid" aria-label="Overview">
            <div className="stat">
              <span className="stat-value">{stats.totalBlocks}</span>
              <span className="stat-label">Total Blocks</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.totalRooms}</span>
              <span className="stat-label">Total Rooms</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.totalCustomers}</span>
              <span className="stat-label">Total Customers</span>
            </div>
            <div className="stat stat-accent">
              <span className="stat-value">{stats.availableBeds}</span>
              <span className="stat-label">Available Beds</span>
            </div>
          </section>

          <h2 className="section-title">Blocks</h2>
          <div className="grid grid-blocks">
            {data.blocks.map((block, index) => (
              <BlockCard key={block._id} block={block} index={index} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

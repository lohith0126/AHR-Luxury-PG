import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AddRoomModal from '../components/AddRoomModal.jsx';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Icon from '../components/Icon.jsx';
import Loader from '../components/Loader.jsx';
import RoomCard from '../components/RoomCard.jsx';
import { useToast } from '../components/Toast.jsx';
import useFetch from '../hooks/useFetch.js';
import { fetchBlock, fetchRooms } from '../services/api.js';

const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'available', label: 'Available', test: (r) => r.status === 'Available' },
  { key: 'partial', label: 'Partial', test: (r) => r.status === 'Partially Occupied' },
  { key: 'full', label: 'Full', test: (r) => r.status === 'Fully Occupied' },
];

export default function BlockPage() {
  const { blockId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);

  const { data, loading, error, reload } = useFetch(async () => {
    const [block, rooms] = await Promise.all([fetchBlock(blockId), fetchRooms(blockId)]);
    return { block, rooms };
  }, [blockId]);

  const handleCreated = (room) => {
    setModalOpen(false);
    showToast(`Room ${room.roomNumber} added successfully.`);
    reload();
  };

  if (loading && !data) return <Loader text="Loading rooms..." />;
  if (error) {
    return (
      <>
        <ErrorState message={error} onRetry={reload} />
        <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>
          Back to Home
        </button>
      </>
    );
  }

  const { block, rooms } = data;
  const activeFilter = FILTERS.find((f) => f.key === filter);
  const visibleRooms = rooms.filter(activeFilter.test);

  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: block.name }]} />

      <div className="page-head">
        <div>
          <h1 className="page-title">{block.name}</h1>
          <p className="muted">
            {block.floors} {block.floors === 1 ? 'Floor' : 'Floors'} · {block.roomCount} Rooms ·{' '}
            {block.availableBeds} beds available
          </p>
        </div>
        <button type="button" className="btn btn-gold" onClick={() => setModalOpen(true)}>
          <Icon name="plus" size={18} /> Add Room
        </button>
      </div>

      {rooms.length === 0 ? (
        <EmptyState title="No rooms added yet.">
          <button type="button" className="btn btn-gold" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={18} /> Add Room
          </button>
        </EmptyState>
      ) : (
        <>
          <div className="tabs" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                className={`tab ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label} ({rooms.filter(f.test).length})
              </button>
            ))}
          </div>
          {visibleRooms.length === 0 ? (
            <EmptyState title="No rooms match this filter." />
          ) : (
            <div className="grid grid-rooms">
              {visibleRooms.map((room) => (
                <RoomCard key={room._id} room={room} />
              ))}
            </div>
          )}
        </>
      )}

      <AddRoomModal
        open={modalOpen}
        blockId={blockId}
        blockName={block.name}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import CustomerCard from '../components/CustomerCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Icon from '../components/Icon.jsx';
import Loader from '../components/Loader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import useFetch from '../hooks/useFetch.js';
import {
  deleteRoom,
  fetchRoom,
  fetchRoomCustomers,
  getErrorMessage,
  removeCustomer,
} from '../services/api.js';

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [toRemove, setToRemove] = useState(null);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useFetch(async () => {
    const [room, customers] = await Promise.all([fetchRoom(roomId), fetchRoomCustomers(roomId)]);
    return { room, customers };
  }, [roomId]);

  const handleRemove = async () => {
    setBusy(true);
    try {
      await removeCustomer(toRemove._id);
      showToast('Customer removed successfully.');
      setToRemove(null);
      reload();
    } catch (err) {
      showToast(getErrorMessage(err, 'Unable to remove the customer. Please try again.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRoom = async () => {
    setBusy(true);
    try {
      await deleteRoom(roomId);
      showToast('Room deleted successfully.');
      navigate(`/blocks/${data.room.blockId._id}`, { replace: true });
    } catch (err) {
      showToast(getErrorMessage(err, 'Unable to delete the room. Please try again.'), 'error');
      setConfirmDeleteRoom(false);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Loader text="Loading room..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { room, customers } = data;
  const block = room.blockId;
  const isFull = room.available === 0;

  const addCustomerButton = (
    <Link to={`/customers/new?roomId=${room._id}`} className="btn btn-gold">
      <Icon name="plus" size={18} /> Add Customer
    </Link>
  );

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: block.name, to: `/blocks/${block._id}` },
          { label: `Room ${room.roomNumber}` },
        ]}
      />

      <section className="card room-summary">
        <div className="room-summary-head">
          <div>
            <h1 className="page-title">Room {room.roomNumber}</h1>
            <p className="muted">
              {room.roomType} · Capacity: {room.capacity}
            </p>
          </div>
          <StatusBadge status={room.status} />
        </div>
        <div className="summary-stats">
          <div>
            <strong>{room.capacity}</strong>
            <span>Capacity</span>
          </div>
          <div>
            <strong>{room.occupied}</strong>
            <span>Occupied</span>
          </div>
          <div>
            <strong>{room.available}</strong>
            <span>Available</span>
          </div>
        </div>
      </section>

      <div className="page-head">
        <h2 className="section-title">Occupants</h2>
        {isFull ? <span className="badge badge-red badge-lg">Room Full</span> : addCustomerButton}
      </div>

      {customers.length === 0 ? (
        <EmptyState title="No customers assigned to this room.">{addCustomerButton}</EmptyState>
      ) : (
        <div className="grid grid-customers">
          {customers.map((customer) => (
            <CustomerCard key={customer._id} customer={customer} onRemove={setToRemove} />
          ))}
        </div>
      )}

      {room.occupied === 0 && (
        <div className="danger-zone">
          <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmDeleteRoom(true)}>
            <Icon name="trash" size={16} /> Delete Room
          </button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Remove Customer?"
        message={
          toRemove
            ? `Are you sure you want to remove ${toRemove.fullName} from Room ${room.roomNumber}?`
            : ''
        }
        busy={busy}
        onConfirm={handleRemove}
        onCancel={() => setToRemove(null)}
      />
      <ConfirmDialog
        open={confirmDeleteRoom}
        title="Delete Room?"
        message={`Are you sure you want to delete Room ${room.roomNumber}?`}
        confirmLabel="Delete"
        busyLabel="Deleting..."
        busy={busy}
        onConfirm={handleDeleteRoom}
        onCancel={() => setConfirmDeleteRoom(false)}
      />
    </>
  );
}

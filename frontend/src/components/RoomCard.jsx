import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';

const ACCENT = {
  Available: 'accent-green',
  'Partially Occupied': 'accent-orange',
  'Fully Occupied': 'accent-red',
};

export default function RoomCard({ room }) {
  return (
    <Link to={`/rooms/${room._id}`} className={`card room-card ${ACCENT[room.status]}`}>
      <div className="room-card-head">
        <div className="room-title">
          <Icon name="bed" size={22} />
          <h3>Room {room.roomNumber}</h3>
        </div>
        <StatusBadge status={room.status} />
      </div>
      <p className="room-type">
        {room.roomType} · {room.capacity} {room.capacity === 1 ? 'Bed' : 'Beds'}
      </p>
      <div className="beds" aria-hidden="true">
        {Array.from({ length: room.capacity }).map((_, i) => (
          <span key={i} className={`bed-dot ${i < room.occupied ? 'filled' : ''}`} />
        ))}
      </div>
      <p className="room-counts">
        <strong>{room.occupied}</strong> Occupied · <strong>{room.available}</strong> Available
      </p>
    </Link>
  );
}

import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

export default function BlockCard({ block, index }) {
  return (
    <Link to={`/blocks/${block._id}`} className="card block-card">
      <div className="block-icon">
        <Icon name="building" size={28} />
      </div>
      <div className="block-info">
        <span className="block-tag">Block {index + 1}</span>
        <h3>{block.name}</h3>
        <p>
          {block.floors} {block.floors === 1 ? 'Floor' : 'Floors'} · {block.roomCount}{' '}
          {block.roomCount === 1 ? 'Room' : 'Rooms'}
        </p>
        <p className="muted">
          {block.occupiedBeds} of {block.totalBeds} beds occupied
        </p>
      </div>
      <Icon name="chevron-right" className="chevron" />
    </Link>
  );
}

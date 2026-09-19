import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';

export default function NotFound() {
  return (
    <EmptyState title="This page does not exist.">
      <Link to="/" className="btn btn-gold">
        Go to Home
      </Link>
    </EmptyState>
  );
}

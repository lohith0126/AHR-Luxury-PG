import { Link } from 'react-router-dom';
import CustomerAvatar from './CustomerAvatar.jsx';
import Icon from './Icon.jsx';

export default function CustomerCard({ customer, onRemove }) {
  return (
    <div className="card customer-card">
      <div className="customer-main">
        <CustomerAvatar customer={customer} />
        <div className="customer-text">
          <h3>{customer.fullName}</h3>
          <p>
            <Icon name="phone" size={14} /> {customer.mobile}
          </p>
        </div>
      </div>
      <div className="card-actions">
        <Link to={`/customers/${customer._id}`} className="btn btn-outline btn-sm">
          <Icon name="eye" size={16} /> View
        </Link>
        {onRemove && (
          <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => onRemove(customer)}>
            <Icon name="trash" size={16} /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

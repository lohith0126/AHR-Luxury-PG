import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Icon from '../components/Icon.jsx';
import Loader from '../components/Loader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import useFetch from '../hooks/useFetch.js';
import { fetchCustomers } from '../services/api.js';
import { initials } from '../utils/format.js';

const STATUS_TABS = ['Active', 'Checked Out', 'All'];

export default function CustomersPage() {
  const [status, setStatus] = useState('Active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: customers, loading, error, reload } = useFetch(
    () => fetchCustomers({ status: status === 'All' ? undefined : status, q: debouncedSearch || undefined }),
    [status, debouncedSearch]
  );

  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Customers' }]} />
      <h1 className="page-title">Customers</h1>

      <div className="search-box">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="Search by name or mobile"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search customers"
        />
      </div>

      <div className="tabs" role="tablist">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={status === tab}
            className={`tab ${status === tab ? 'active' : ''}`}
            onClick={() => setStatus(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading && !customers && <Loader text="Loading customers..." />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {customers && customers.length === 0 && (
        <EmptyState title="No customers found.">
          <p className="muted">Open a block and room to add a customer.</p>
        </EmptyState>
      )}
      {customers && customers.length > 0 && (
        <div className="grid grid-customers">
          {customers.map((c) => (
            <Link key={c._id} to={`/customers/${c._id}`} className="card customer-row">
              <div className="avatar">{initials(c.fullName)}</div>
              <div className="customer-text">
                <h3>{c.fullName}</h3>
                <p className="muted">
                  {c.blockId?.name} · Room {c.roomId?.roomNumber}
                </p>
                <p className="muted">{c.mobile}</p>
              </div>
              <StatusBadge status={c.status} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

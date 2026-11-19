import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import CustomerAvatar from '../components/CustomerAvatar.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Icon from '../components/Icon.jsx';
import Loader from '../components/Loader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import useFetch from '../hooks/useFetch.js';
import {
  fetchCustomer,
  fetchCustomerPaymentHistory,
  getErrorMessage,
  idProofUrl,
  removeCustomer,
} from '../services/api.js';
import { MONTH_NAMES } from '../utils/constants.js';
import { formatBillingMonth, formatCurrency, formatDate, maskIdNumber } from '../utils/format.js';

function Detail({ label, children }) {
  return (
    <div className="detail">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{children || '—'}</span>
    </div>
  );
}

/** Month-by-month rent records for one customer - the very same records the Payments page edits. */
function PaymentHistory({ customerId }) {
  const { data: history, loading, error, reload } = useFetch(() => fetchCustomerPaymentHistory(customerId), [customerId]);
  const [selectedYear, setSelectedYear] = useState(null);

  const years = useMemo(
    () => [...new Set((history || []).map((r) => Number(r.billingMonth.slice(0, 4))))].sort((a, b) => b - a),
    [history]
  );
  useEffect(() => {
    if (years.length && !years.includes(selectedYear)) setSelectedYear(years[0]);
  }, [years, selectedYear]);

  if (loading && !history) return <Loader text="Loading payment history..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!history || history.length === 0) {
    return <p className="muted">No monthly payment records yet. They appear once rent is set and billing starts.</p>;
  }

  const index = years.indexOf(selectedYear);
  const rows = history.filter((r) => Number(r.billingMonth.slice(0, 4)) === selectedYear);

  return (
    <>
      <div className="history-nav">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedYear(years[index + 1])} disabled={index >= years.length - 1} aria-label="Earlier year">
          <Icon name="chevron-left" size={16} />
        </button>
        <h3>{selectedYear}</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedYear(years[index - 1])} disabled={index <= 0} aria-label="Later year">
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
      <div className="history-list">
        {rows.map((record) => (
          <div key={record.billingMonth} className="history-row">
            <span className="history-row-month">{formatBillingMonth(record.billingMonth, MONTH_NAMES)}</span>
            <div className="history-row-meta">
              <span>{formatCurrency(record.rentAmount)}</span>
              <span className={`badge ${record.status === 'Paid' ? 'badge-green' : 'badge-red'}`}>{record.status}</span>
            </div>
            <span className="muted history-row-date">{record.paidOn ? `Paid on ${formatDate(record.paidOn)}` : 'Not paid yet'}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: customer, loading, error, reload } = useFetch(() => fetchCustomer(id), [id]);

  const handleRemove = async () => {
    setBusy(true);
    try {
      await removeCustomer(id);
      showToast('Customer removed successfully.');
      navigate(customer.roomId ? `/rooms/${customer.roomId._id}` : '/customers', { replace: true });
    } catch (err) {
      showToast(getErrorMessage(err, 'Unable to remove the customer. Please try again.'), 'error');
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !customer) return <Loader text="Loading customer..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { blockId: block, roomId: room, rentSummary, idProofMeta } = customer;
  const isActive = customer.status === 'Active';
  const docUrl = idProofUrl(customer._id, customer.updatedAt);
  const docAvailable = Boolean(idProofMeta?.available);
  const docIsPdf = idProofMeta?.contentType === 'application/pdf';

  const rentText =
    rentSummary?.current != null ? (
      <>
        {formatCurrency(rentSummary.current)}
        {rentSummary.pending && (
          <span className="muted">
            {' '}
            → {formatCurrency(rentSummary.pending.rent)} from {formatBillingMonth(rentSummary.pending.effectiveFrom, MONTH_NAMES)}
          </span>
        )}
      </>
    ) : rentSummary?.billingStartsOn ? (
      `${formatCurrency(customer.monthlyRent)} from ${formatBillingMonth(rentSummary.billingStartsOn, MONTH_NAMES)}`
    ) : (
      'Not set — use Edit Customer'
    );

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: block.name, to: `/blocks/${block._id}` },
          { label: `Room ${room.roomNumber}`, to: `/rooms/${room._id}` },
          { label: customer.fullName },
        ]}
      />

      <section className="card profile">
        <div className="profile-head">
          <CustomerAvatar customer={customer} size="lg" />
          <div>
            <h1 className="page-title">{customer.fullName}</h1>
            <StatusBadge status={customer.status} />
          </div>
        </div>

        <div className="detail-grid">
          <Detail label="Mobile">
            <a href={`tel:${customer.mobile}`}>{customer.mobile}</a>
          </Detail>
          <Detail label="Email">{customer.email}</Detail>
          <Detail label="Building">{block.name}</Detail>
          <Detail label="Room">
            <Link to={`/rooms/${room._id}`}>
              {room.roomNumber} ({room.roomType})
            </Link>
          </Detail>
          <Detail label="Sharing">{customer.sharingType}</Detail>
          <Detail label="Date of Joining">{formatDate(customer.dateOfJoining)}</Detail>
          <Detail label="Expected Check Out">{formatDate(customer.expectedCheckoutDate)}</Detail>
          {!isActive && <Detail label="Checked Out On">{formatDate(customer.actualCheckoutDate)}</Detail>}
          <Detail label="Monthly Rent">{rentText}</Detail>
          <Detail label="Security Deposit">{formatCurrency(customer.securityDeposit ?? 0)}</Detail>
          <Detail label="ID Proof">{customer.idProofType}</Detail>
          <Detail label="ID Number">{maskIdNumber(customer.idProofType, customer.idNumber)}</Detail>
        </div>
      </section>

      <section className="card doc-card">
        <h2 className="section-title">ID Proof</h2>
        {!docAvailable ? (
          <p className="alert alert-warn">
            The uploaded ID document could not be found.
            {isActive && ' Use Edit Customer to upload it again.'}
          </p>
        ) : (
          <div className="doc-box">
            {!docIsPdf && (
              <a href={docUrl} target="_blank" rel="noreferrer">
                <img className="doc-preview" src={docUrl} alt="Uploaded ID proof" />
              </a>
            )}
            <a className="btn btn-outline" href={docUrl} target="_blank" rel="noreferrer">
              <Icon name="file" size={18} /> {docIsPdf ? `Open PDF${idProofMeta.originalName ? ` (${idProofMeta.originalName})` : ''}` : 'View Uploaded Document'}
            </a>
          </div>
        )}
      </section>

      <section className="card history-card">
        <h2 className="section-title">Payment History</h2>
        <PaymentHistory customerId={customer._id} />
      </section>

      {isActive && (
        <div className="action-bar">
          <Link to={`/customers/${customer._id}/edit`} className="btn btn-gold">
            <Icon name="edit" size={18} /> Edit Customer
          </Link>
          <button type="button" className="btn btn-danger" onClick={() => setConfirmOpen(true)}>
            <Icon name="trash" size={18} /> Remove Customer
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Remove Customer?"
        message={`Are you sure you want to remove ${customer.fullName} from Room ${room.roomNumber}?`}
        busy={busy}
        onConfirm={handleRemove}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

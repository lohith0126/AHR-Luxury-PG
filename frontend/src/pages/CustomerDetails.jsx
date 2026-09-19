import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Icon from '../components/Icon.jsx';
import Loader from '../components/Loader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import useFetch from '../hooks/useFetch.js';
import { fetchCustomer, fileUrl, getErrorMessage, removeCustomer } from '../services/api.js';
import { formatDate, initials, isPdf, maskIdNumber } from '../utils/format.js';

function Detail({ label, children }) {
  return (
    <div className="detail">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{children || '—'}</span>
    </div>
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

  const { blockId: block, roomId: room } = customer;
  const isActive = customer.status === 'Active';
  const docUrl = fileUrl(customer.idProofFile);
  const docIsImage = !isPdf(customer.idProofFile);

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
          {docIsImage ? (
            <img className="avatar avatar-lg avatar-img" src={docUrl} alt="" />
          ) : (
            <div className="avatar avatar-lg">{initials(customer.fullName)}</div>
          )}
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
          <Detail label="ID Proof">{customer.idProofType}</Detail>
          <Detail label="ID Number">{maskIdNumber(customer.idProofType, customer.idNumber)}</Detail>
        </div>

        <div className="doc-box">
          <span className="detail-label">ID Proof Document</span>
          {docIsImage && (
            <a href={docUrl} target="_blank" rel="noreferrer">
              <img className="doc-preview" src={docUrl} alt="Uploaded ID proof" />
            </a>
          )}
          <a className="btn btn-outline" href={docUrl} target="_blank" rel="noreferrer">
            <Icon name="file" size={18} /> View Uploaded Document
          </a>
        </div>
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

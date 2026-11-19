import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Icon from '../components/Icon.jsx';
import Loader from '../components/Loader.jsx';
import ReportModal from '../components/ReportModal.jsx';
import { useToast } from '../components/Toast.jsx';
import useFetch from '../hooks/useFetch.js';
import { fetchBlocks, fetchMonthlyPayments, getErrorMessage, updatePaymentStatus } from '../services/api.js';
import { MONTH_NAMES } from '../utils/constants.js';
import { currentBillingMonth, formatCurrency, formatBillingMonth, splitBillingMonth, toBillingMonth } from '../utils/format.js';

export default function PaymentsPage() {
  const { showToast } = useToast();
  const [billingMonth, setBillingMonth] = useState(currentBillingMonth());
  const [blockId, setBlockId] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const { year, month } = splitBillingMonth(billingMonth);

  const { data: blocks } = useFetch(fetchBlocks, []);
  const { data, loading, error, reload } = useFetch(
    () => fetchMonthlyPayments(billingMonth, blockId || undefined),
    [billingMonth, blockId]
  );

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => current - 5 + i);
  }, []);

  // Persist first; the screen only changes after the server confirms (reload re-reads the truth).
  const toggleStatus = async (row) => {
    const nextStatus = row.status === 'Paid' ? 'Due' : 'Paid';
    setUpdatingId(row._id);
    try {
      await updatePaymentStatus(row._id, nextStatus);
      showToast(`${row.customerName} marked ${nextStatus}.`);
      reload();
    } catch (err) {
      showToast(getErrorMessage(err, 'Unable to update payment status. Please try again.'), 'error');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Payments' }]} />
      <div className="page-head">
        <h1 className="page-title">Payments</h1>
        <button type="button" className="btn btn-gold" onClick={() => setReportOpen(true)}>
          <Icon name="download" size={18} /> Generate Report
        </button>
      </div>

      <div className="payments-filters">
        <div className="field">
          <label htmlFor="pay-month">Month</label>
          <select id="pay-month" value={month} onChange={(e) => setBillingMonth(toBillingMonth(year, Number(e.target.value)))}>
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pay-year">Year</label>
          <select id="pay-year" value={year} onChange={(e) => setBillingMonth(toBillingMonth(Number(e.target.value), month))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pay-block">Building</label>
          <select id="pay-block" value={blockId} onChange={(e) => setBlockId(e.target.value)}>
            <option value="">All Buildings</option>
            {blocks?.map((block) => (
              <option key={block._id} value={block._id}>
                {block.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && !data && <Loader text="Loading payments..." />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <p className="muted payments-period">Showing {formatBillingMonth(data.month, MONTH_NAMES)}</p>
          <section className="stats-grid payments-summary" aria-label="Monthly summary">
            <div className="stat">
              <span className="stat-value">{data.summary.totalCustomers}</span>
              <span className="stat-label">Active Customers</span>
            </div>
            <div className="stat">
              <span className="stat-value" style={{ color: 'var(--green)' }}>{data.summary.paidCount}</span>
              <span className="stat-label">Paid</span>
            </div>
            <div className="stat">
              <span className="stat-value" style={{ color: 'var(--red)' }}>{data.summary.dueCount}</span>
              <span className="stat-label">Due</span>
            </div>
            <div className="stat">
              <span className="stat-value">{formatCurrency(data.summary.rentCollected)}</span>
              <span className="stat-label">Rent Collected</span>
            </div>
            <div className="stat stat-accent">
              <span className="stat-value">{formatCurrency(data.summary.rentPending)}</span>
              <span className="stat-label">Rent Pending</span>
            </div>
          </section>

          {data.missingRent.length > 0 && (
            <div className="alert alert-warn" role="status">
              <strong>{data.missingRent.length} active customer(s) have no monthly rent yet</strong> and are not billed.
              Open each one and choose Edit Customer to add the rent:
              <ul className="missing-list">
                {data.missingRent.map((c) => (
                  <li key={c.customerId}>
                    <Link to={`/customers/${c.customerId}/edit`}>
                      {c.customerName} ({c.blockName} · Room {c.roomNumber})
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.rows.length === 0 ? (
            <EmptyState title="No customers are billed for this month." />
          ) : (
            <div className="grid grid-payments">
              {data.rows.map((row) => (
                <div key={row._id} className="card payment-row">
                  <div className="payment-row-main">
                    <Link to={`/customers/${row.customerId}`} className="payment-name">
                      {row.customerName}
                    </Link>
                    <p className="muted">
                      {row.blockName} · Room {row.roomNumber}
                    </p>
                  </div>
                  <div className="payment-row-amount">
                    <span className="payment-rent">{formatCurrency(row.rentAmount)}</span>
                    <span className={`badge ${row.status === 'Paid' ? 'badge-green' : 'badge-red'}`}>{row.status}</span>
                  </div>
                  <button
                    type="button"
                    className={`btn btn-sm ${row.status === 'Paid' ? 'btn-outline' : 'btn-gold'}`}
                    onClick={() => toggleStatus(row)}
                    disabled={updatingId === row._id}
                  >
                    {updatingId === row._id ? (
                      'Saving...'
                    ) : row.status === 'Paid' ? (
                      <>
                        <Icon name="x" size={15} /> Mark Due
                      </>
                    ) : (
                      <>
                        <Icon name="check" size={15} /> Mark Paid
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        blocks={blocks}
        defaultMonth={billingMonth}
        defaultBlockId={blockId}
      />
    </>
  );
}

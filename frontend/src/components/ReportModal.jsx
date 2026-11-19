import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import { downloadReport, getErrorMessage, saveBlob } from '../services/api.js';
import { MONTH_NAMES } from '../utils/constants.js';
import { splitBillingMonth, toBillingMonth } from '../utils/format.js';

const FILE_EXTENSIONS = { pdf: 'pdf', xlsx: 'xlsx' };

/** Generate Report: Overall PG or one block, for a chosen month/year, as PDF or Excel. */
export default function ReportModal({ open, onClose, blocks, defaultMonth, defaultBlockId }) {
  const [blockId, setBlockId] = useState('');
  const [billingMonth, setBillingMonth] = useState(defaultMonth);
  const [busyFormat, setBusyFormat] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setBlockId(defaultBlockId || '');
      setBillingMonth(defaultMonth);
      setError('');
    }
  }, [open, defaultMonth, defaultBlockId]);

  const { year, month } = splitBillingMonth(billingMonth);
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => current - 5 + i);
  }, []);

  const scopeLabel = blocks?.find((b) => b._id === blockId)?.name || 'Overall PG';

  const generate = async (format) => {
    if (busyFormat) return;
    setBusyFormat(format);
    setError('');
    try {
      const blob = await downloadReport({ blockId, month: billingMonth, format });
      const scope = scopeLabel.replace(/[^a-z0-9]+/gi, '-');
      saveBlob(blob, `AHR-PG-Report-${scope}-${billingMonth}.${FILE_EXTENSIONS[format]}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to generate the report. Please try again.'));
    } finally {
      setBusyFormat('');
    }
  };

  return (
    <Modal open={open} title="Generate Report" onClose={busyFormat ? () => {} : onClose}>
      <div className="form-stack">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="report-scope">Report for</label>
          <select id="report-scope" value={blockId} onChange={(e) => setBlockId(e.target.value)} disabled={Boolean(busyFormat)}>
            <option value="">Overall PG (all blocks)</option>
            {blocks?.map((block) => (
              <option key={block._id} value={block._id}>
                {block.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="report-month">Month</label>
            <select
              id="report-month"
              value={month}
              onChange={(e) => setBillingMonth(toBillingMonth(year, Number(e.target.value)))}
              disabled={Boolean(busyFormat)}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="report-year">Year</label>
            <select
              id="report-year"
              value={year}
              onChange={(e) => setBillingMonth(toBillingMonth(Number(e.target.value), month))}
              disabled={Boolean(busyFormat)}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="field-hint">
          Includes current occupancy and customers for {scopeLabel}, plus the rent payment status for the selected month.
        </p>

        <div className="modal-actions">
          <button type="button" className="btn btn-gold" onClick={() => generate('pdf')} disabled={Boolean(busyFormat)}>
            <Icon name="download" size={18} /> {busyFormat === 'pdf' ? 'Generating...' : 'Download PDF'}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => generate('xlsx')} disabled={Boolean(busyFormat)}>
            <Icon name="download" size={18} /> {busyFormat === 'xlsx' ? 'Generating...' : 'Download Excel'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

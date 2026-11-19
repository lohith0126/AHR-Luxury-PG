/** ISO date -> DD-MM-YYYY (UTC, so the stored calendar date never shifts). */
export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
};

/** ISO date -> YYYY-MM-DD for <input type="date">. */
export const toInputDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

export const todayInputDate = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export const maskIdNumber = (type, number = '') => {
  const compact = number.replace(/\s/g, '');
  const last = compact.slice(-4);
  if (type === 'Aadhaar Card') return `XXXX XXXX ${last}`;
  return `${'X'.repeat(Math.max(compact.length - 4, 0))}${last}`;
};

export const isPdf = (filename = '') => filename.toLowerCase().endsWith('.pdf');

export const currentBillingMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** "YYYY-MM" -> { year, month } (1-indexed month), for the month/year dropdowns. */
export const splitBillingMonth = (ym) => {
  const [year, month] = ym.split('-').map(Number);
  return { year, month };
};

export const toBillingMonth = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

/** "YYYY-MM" -> "October 2026" */
export const formatBillingMonth = (ym, monthNames) => {
  const { year, month } = splitBillingMonth(ym);
  return `${monthNames[month - 1]} ${year}`;
};

export const formatCurrency = (amount = 0) =>
  `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

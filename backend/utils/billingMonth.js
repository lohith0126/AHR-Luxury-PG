const YM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const isValidBillingMonth = (value) => typeof value === 'string' && YM_PATTERN.test(value);

const pad = (n) => String(n).padStart(2, '0');

const currentBillingMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

/** Date -> "YYYY-MM" in UTC, so a stored calendar date never shifts with timezone. */
const toBillingMonth = (date) => {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

/** [start, end) UTC bounds of a "YYYY-MM" month. */
const billingMonthRange = (ym) => {
  const [year, month] = ym.split('-').map(Number);
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
};

/** "2026-12" + 1 -> "2027-01". */
const addMonths = (ym, count) => {
  const [year, month] = ym.split('-').map(Number);
  const index = year * 12 + (month - 1) + count;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
};

/** Inclusive list of months from `start` to `end` (capped, to avoid runaway loops). */
const monthsBetween = (start, end, cap = 240) => {
  const months = [];
  for (let m = start; m <= end && months.length < cap; m = addMonths(m, 1)) months.push(m);
  return months;
};

/** "2026-10" -> "October 2026". */
const formatBillingMonthLabel = (ym) => {
  const [year, month] = ym.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
};

module.exports = {
  MONTH_NAMES,
  isValidBillingMonth,
  currentBillingMonth,
  toBillingMonth,
  billingMonthRange,
  addMonths,
  monthsBetween,
  formatBillingMonthLabel,
};

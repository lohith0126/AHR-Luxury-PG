const { currentBillingMonth, toBillingMonth, addMonths } = require('./billingMonth');

/**
 * Rent history rule
 * -----------------
 * Customer.rentHistory is a list of { rent, effectiveFrom: "YYYY-MM" }.
 * The rent billed for a month is the entry with the latest effectiveFrom that
 * is <= that month. A rent change made during month M is recorded with
 * effectiveFrom = M + 1, so it only affects FUTURE billing months. Payment
 * records also store their own rentAmount snapshot when created, so nothing
 * already generated is ever rewritten.
 */

/** Rent that applies to `month`, or null if billing for the customer hasn't started by then. */
const rentForMonth = (rentHistory, month) => {
  let match = null;
  (rentHistory || []).forEach((entry) => {
    if (entry.effectiveFrom <= month && (!match || entry.effectiveFrom >= match.effectiveFrom)) {
      match = entry;
    }
  });
  return match ? match.rent : null;
};

/** First billing month for a customer (the earliest effectiveFrom), or null for legacy customers with no rent. */
const firstBillingMonth = (rentHistory) =>
  (rentHistory || []).reduce((min, e) => (min === null || e.effectiveFrom < min ? e.effectiveFrom : min), null);

/**
 * Returns the new rentHistory after the owner saves `newRent`.
 *  - New customer: billing starts in the joining month.
 *  - Legacy customer (no history yet, from the first app version): billing starts in the
 *    current month (or the joining month if that is later) - past months are NOT invented.
 *  - Existing history, same rent: unchanged.
 *  - Billing not started yet: correct the starting rent in place.
 *  - Otherwise: new rent applies from next month; any not-yet-effective change is replaced.
 */
const nextRentHistory = ({ rentHistory = [], newRent, joiningDate, isNew = false, today = currentBillingMonth() }) => {
  const history = rentHistory.map((e) => ({ rent: e.rent, effectiveFrom: e.effectiveFrom }));
  const joiningMonth = toBillingMonth(joiningDate);

  if (history.length === 0) {
    const start = isNew ? joiningMonth : joiningMonth > today ? joiningMonth : today;
    return [{ rent: newRent, effectiveFrom: start }];
  }

  const first = firstBillingMonth(history);
  if (first > today) return [{ rent: newRent, effectiveFrom: first }];

  const latest = history.reduce((a, b) => (b.effectiveFrom >= a.effectiveFrom ? b : a));
  if (latest.rent === newRent) return history;

  const effectiveFrom = addMonths(today, 1);
  return [...history.filter((e) => e.effectiveFrom < effectiveFrom), { rent: newRent, effectiveFrom }];
};

/** { current, pending } for display: rent for this month, and a change scheduled for later. */
const summarizeRent = (rentHistory, today = currentBillingMonth()) => {
  const current = rentForMonth(rentHistory, today);
  const future = (rentHistory || [])
    .filter((e) => e.effectiveFrom > today)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
  const started = firstBillingMonth(rentHistory);
  return {
    current,
    pending: future && started && started <= today ? { rent: future.rent, effectiveFrom: future.effectiveFrom } : null,
    billingStartsOn: started && started > today ? started : null,
  };
};

module.exports = { rentForMonth, firstBillingMonth, nextRentHistory, summarizeRent };

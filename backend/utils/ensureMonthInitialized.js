const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const { PAYMENT_STATUS } = require('../config/constants');
const { billingMonthRange, currentBillingMonth, toBillingMonth, monthsBetween } = require('./billingMonth');
const { rentForMonth, firstBillingMonth } = require('./rent');

/**
 * BILLING ELIGIBILITY RULE (change it here if you ever want pro-rating etc.)
 * A customer is billed the full rent for a month when:
 *   - their joining date is on or before the END of that month, and
 *   - they have no checkout date, or it falls on/after the START of that month, and
 *   - they have a rent on record for that month (see utils/rent.js).
 * A customer who checks out mid-month is billed for that month but never for later ones.
 */
const eligibleFilter = (month) => {
  const { start, end } = billingMonthRange(month);
  return {
    dateOfJoining: { $lt: end },
    'rentHistory.0': { $exists: true },
    $or: [{ actualCheckoutDate: null }, { actualCheckoutDate: { $gte: start } }],
  };
};

const isOnlyDuplicateKeyErrors = (err) =>
  Array.isArray(err.writeErrors) &&
  err.writeErrors.length > 0 &&
  err.writeErrors.every((e) => (e.code ?? e.err?.code) === 11000);

/**
 * Inserts the given upsert operations. Each is "create if missing, otherwise do nothing"
 * ($setOnInsert only), so it can never overwrite a status the owner already set, and the
 * unique (customerId, billingMonth) index is the final guard if two requests race.
 */
const runUpserts = async (ops) => {
  if (ops.length === 0) return 0;
  try {
    const result = await Payment.bulkWrite(ops, { ordered: false });
    return result.upsertedCount || 0;
  } catch (err) {
    if (isOnlyDuplicateKeyErrors(err)) return 0; // another request created them first - fine
    throw err;
  }
};

const upsertOp = (customer, month, rent) => ({
  updateOne: {
    filter: { customerId: customer._id, billingMonth: month },
    update: {
      $setOnInsert: {
        blockId: customer.blockId,
        roomId: customer.roomId,
        rentAmount: rent,
        status: PAYMENT_STATUS.DUE,
        paidOn: null,
      },
    },
    upsert: true,
  },
});

/** Creates any missing Due records for one billing month. Idempotent. */
const ensureMonthInitialized = async (month, { blockId } = {}) => {
  const filter = eligibleFilter(month);
  if (blockId) filter.blockId = blockId;

  const customers = await Customer.find(filter).select('blockId roomId rentHistory').lean();
  const ops = customers.flatMap((customer) => {
    const rent = rentForMonth(customer.rentHistory, month);
    return rent ? [upsertOp(customer, month, rent)] : [];
  });
  const created = await runUpserts(ops);
  return { eligible: ops.length, created };
};

/**
 * Creates any missing Due records for ALL months of one customer's stay up to now
 * (or up to their checkout month). Used for Payment History so it is complete.
 */
const ensureCustomerMonths = async (customerId) => {
  const customer = await Customer.findById(customerId)
    .select('blockId roomId rentHistory dateOfJoining actualCheckoutDate')
    .lean();
  if (!customer) return { created: 0 };

  const first = firstBillingMonth(customer.rentHistory);
  if (!first) return { created: 0 }; // legacy customer with no rent set yet

  const today = currentBillingMonth();
  const last = customer.actualCheckoutDate ? toBillingMonth(customer.actualCheckoutDate) : today;
  const end = last < today ? last : today;
  const ops = monthsBetween(first, end).flatMap((month) => {
    const rent = rentForMonth(customer.rentHistory, month);
    return rent ? [upsertOp(customer, month, rent)] : [];
  });
  return { created: await runUpserts(ops) };
};

module.exports = { ensureMonthInitialized, ensureCustomerMonths };

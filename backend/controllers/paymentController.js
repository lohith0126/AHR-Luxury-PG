const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { ensureMonthInitialized, ensureCustomerMonths } = require('../utils/ensureMonthInitialized');
const { PAYMENT_STATUS, CUSTOMER_STATUS } = require('../config/constants');
const { isValidBillingMonth, currentBillingMonth } = require('../utils/billingMonth');

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const PAYMENT_POPULATE = [
  { path: 'customerId', select: 'fullName' },
  { path: 'blockId', select: 'name' },
  { path: 'roomId', select: 'roomNumber' },
];

const resolveMonth = (raw) => {
  if (raw === undefined || raw === '') return currentBillingMonth();
  if (!isValidBillingMonth(raw)) throw new HttpError(400, 'Month must be in YYYY-MM format.');
  return raw;
};

/** Flat row for the UI. Names are read live, so renamed blocks / edited names show correctly. */
const toRow = (payment) => ({
  _id: payment._id,
  customerId: payment.customerId?._id || payment.customerId,
  customerName: payment.customerId?.fullName || 'Unknown customer',
  blockId: payment.blockId?._id || payment.blockId,
  blockName: payment.blockId?.name || '—',
  roomNumber: payment.roomId?.roomNumber || '—',
  billingMonth: payment.billingMonth,
  rentAmount: payment.rentAmount,
  status: payment.status,
  paidOn: payment.paidOn,
});

const summarize = (rows) => {
  const paid = rows.filter((r) => r.status === PAYMENT_STATUS.PAID);
  const due = rows.filter((r) => r.status === PAYMENT_STATUS.DUE);
  const sum = (list) => list.reduce((total, r) => total + r.rentAmount, 0);
  return {
    totalCustomers: rows.length,
    paidCount: paid.length,
    dueCount: due.length,
    rentCollected: sum(paid),
    rentPending: sum(due),
  };
};

/** GET /api/payments?month=YYYY-MM&blockId=  - creates the month's missing Due records, then lists them. */
const getMonthlyPayments = asyncHandler(async (req, res) => {
  const month = resolveMonth(req.query.month);
  const blockId = req.query.blockId || undefined;
  if (blockId && !mongoose.isValidObjectId(blockId)) throw new HttpError(404, 'Block not found.');

  await ensureMonthInitialized(month, { blockId });

  const filter = { billingMonth: month };
  if (blockId) filter.blockId = blockId;
  const records = await Payment.find(filter).populate(PAYMENT_POPULATE).lean();
  const rows = records.map(toRow).sort(
    (a, b) =>
      collator.compare(a.blockName, b.blockName) ||
      collator.compare(a.roomNumber, b.roomNumber) ||
      collator.compare(a.customerName, b.customerName)
  );

  // Active customers saved before rent existed can't be billed yet - tell the owner who they are.
  const missingFilter = { status: CUSTOMER_STATUS.ACTIVE, 'rentHistory.0': { $exists: false } };
  if (blockId) missingFilter.blockId = blockId;
  const missingRent = await Customer.find(missingFilter)
    .select('fullName blockId roomId')
    .populate([
      { path: 'blockId', select: 'name' },
      { path: 'roomId', select: 'roomNumber' },
    ])
    .lean();

  res.json({
    month,
    rows,
    summary: summarize(rows),
    missingRent: missingRent.map((c) => ({
      customerId: c._id,
      customerName: c.fullName,
      blockName: c.blockId?.name || '—',
      roomNumber: c.roomId?.roomNumber || '—',
    })),
  });
});

/** PATCH /api/payments/:id  { status: "Paid" | "Due" } */
const updatePaymentStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Payment record not found.');
  const { status } = req.body || {};
  if (![PAYMENT_STATUS.PAID, PAYMENT_STATUS.DUE].includes(status)) {
    throw new HttpError(400, 'Status must be Paid or Due.');
  }

  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new HttpError(404, 'Payment record not found.');

  if (payment.status !== status) {
    payment.status = status;
    payment.paidOn = status === PAYMENT_STATUS.PAID ? new Date() : null;
    await payment.save();
  }
  await payment.populate(PAYMENT_POPULATE);
  res.json(toRow(payment.toObject()));
});

/** GET /api/customers/:id/payments - the same records the Payments page shows, for one customer. */
const getCustomerPaymentHistory = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Customer not found.');
  const customer = await Customer.findById(req.params.id).select('_id');
  if (!customer) throw new HttpError(404, 'Customer not found.');

  await ensureCustomerMonths(customer._id);
  const records = await Payment.find({ customerId: customer._id })
    .sort({ billingMonth: -1 })
    .select('billingMonth rentAmount status paidOn')
    .lean();
  res.json(records);
});

module.exports = { getMonthlyPayments, updatePaymentStatus, getCustomerPaymentHistory };

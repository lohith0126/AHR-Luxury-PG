const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../config/constants');

/**
 * One document per (customer, billing month). Created idempotently by
 * utils/ensureMonthInitialized.js as "Due"; afterwards only the owner changes it.
 * blockId / roomId record where the customer was when the month was billed, so
 * history survives a later room move. Names are read live (populate) so a renamed
 * block or edited customer name is never stale. rentAmount is a snapshot.
 */
const paymentSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    billingMonth: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // "YYYY-MM"
    rentAmount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.DUE },
    paidOn: { type: Date, default: null },
  },
  { timestamps: true }
);

// Hard guarantee: at most one record per customer per month.
paymentSchema.index({ customerId: 1, billingMonth: 1 }, { unique: true });
paymentSchema.index({ billingMonth: 1, blockId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);

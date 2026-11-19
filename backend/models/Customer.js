const mongoose = require('mongoose');
const { SHARING_TYPES, ID_PROOF_TYPES, CUSTOMER_STATUS } = require('../config/constants');

const rentEntrySchema = new mongoose.Schema(
  {
    rent: { type: Number, required: true, min: 1 },
    effectiveFrom: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // "YYYY-MM"
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true, index: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    sharingType: { type: String, required: true, enum: Object.keys(SHARING_TYPES) },
    dateOfJoining: { type: Date, required: true },
    expectedCheckoutDate: { type: Date },
    actualCheckoutDate: { type: Date },

    // NEW - both hold a StoredFile _id (24-hex string). Documents created by the first
    // version hold a legacy disk filename in idProofFile until importLegacyFiles converts it.
    profilePhoto: { type: String, default: '' },
    idProofType: { type: String, required: true, enum: ID_PROOF_TYPES },
    idNumber: { type: String, required: true, trim: true },
    idProofFile: { type: String, required: true },

    // NEW - deliberately NOT `required` at schema level: customers saved by the first
    // version have no rent, and required here would make saving/removing them fail.
    // The controller enforces rent > 0 whenever a customer is created or edited.
    securityDeposit: { type: Number, min: 0, default: 0 },
    monthlyRent: { type: Number, min: 1 }, // most recently entered rent (may be scheduled for next month)
    rentHistory: { type: [rentEntrySchema], default: [] }, // source of truth for billing, see utils/rent.js

    status: {
      type: String,
      enum: Object.values(CUSTOMER_STATUS),
      default: CUSTOMER_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

customerSchema.index({ roomId: 1, status: 1 });

module.exports = mongoose.model('Customer', customerSchema);

const mongoose = require('mongoose');
const { SHARING_TYPES, ID_PROOF_TYPES, CUSTOMER_STATUS } = require('../config/constants');

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
    idProofType: { type: String, required: true, enum: ID_PROOF_TYPES },
    idNumber: { type: String, required: true, trim: true },
    idProofFile: { type: String, required: true },
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

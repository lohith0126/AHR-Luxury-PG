const mongoose = require('mongoose');
const { FILE_KINDS } = require('../config/constants');

/**
 * Uploaded profile photos and ID proofs live in MongoDB rather than on the web
 * server's disk. Render's local filesystem is wiped on every deploy/restart, so
 * disk-based uploads would silently disappear. Always query with .select('-data')
 * unless you are actually streaming the file.
 */
const storedFileSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: Object.values(FILE_KINDS), required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    originalName: { type: String, default: '', maxlength: 120 },
    data: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('StoredFile', storedFileSchema);

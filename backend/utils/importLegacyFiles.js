const fs = require('fs');
const Customer = require('../models/Customer');
const { prepareUpload, storeFile, isStoredRef, legacyPath, ID_PROOF_TYPES_ALLOWED } = require('./files');
const { FILE_KINDS, MAX_FILE_SIZE } = require('../config/constants');

/**
 * Copies ID proofs that the first version saved on local disk into MongoDB and points
 * the customer at the copy. Non-destructive: the original file is left in place.
 * Customers whose file no longer exists on disk are reported, not changed.
 * With { dryRun: true } nothing is written.
 */
const importLegacyFiles = async ({ dryRun = false } = {}) => {
  const legacy = await Customer.find({ idProofFile: { $not: /^[0-9a-f]{24}$/i } }).select('fullName idProofFile');
  const report = { found: legacy.length, imported: 0, missing: [] };

  for (const customer of legacy) {
    const ref = customer.idProofFile;
    if (isStoredRef(ref)) continue;
    let buffer;
    try {
      buffer = await fs.promises.readFile(legacyPath(ref));
    } catch {
      report.missing.push({ id: String(customer._id), name: customer.fullName, file: ref });
      continue;
    }
    if (dryRun) {
      report.imported += 1;
      continue;
    }
    try {
      const prepared = prepareUpload(
        { buffer, size: buffer.length, originalname: ref },
        {
          kind: FILE_KINDS.ID_PROOF,
          field: 'idProofFile',
          allowedTypes: ID_PROOF_TYPES_ALLOWED,
          maxBytes: MAX_FILE_SIZE,
          typeMessage: 'Unsupported legacy file type.',
          sizeMessage: 'Legacy file too large.',
        }
      );
      const newRef = await storeFile(prepared);
      await Customer.updateOne({ _id: customer._id, idProofFile: ref }, { $set: { idProofFile: newRef } });
      report.imported += 1;
    } catch (err) {
      report.missing.push({ id: String(customer._id), name: customer.fullName, file: ref, reason: err.message });
    }
  }
  return report;
};

module.exports = importLegacyFiles;

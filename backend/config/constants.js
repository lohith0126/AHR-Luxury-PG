const path = require('path');

const PG_NAME = 'AHR Luxury PG For Gents';

const ROOM_CAPACITY = { Single: 1, '2 in 1': 2, '3 in 1': 3 };
const SHARING_TYPES = { '1 Sharing': 1, '2 Sharing': 2, '3 Sharing': 3 };
const ID_PROOF_TYPES = ['Aadhaar Card', 'Driving License', 'Passport', 'Voter ID', 'Other'];
const CUSTOMER_STATUS = { ACTIVE: 'Active', CHECKED_OUT: 'Checked Out' };
const PAYMENT_STATUS = { PAID: 'Paid', DUE: 'Due' };
const FILE_KINDS = { PROFILE_PHOTO: 'profilePhoto', ID_PROOF: 'idProof' };

// Legacy location of files uploaded by the first version of the app (local disk).
// Only used by utils/importLegacyFiles.js and as a read-only fallback.
const LEGACY_UPLOAD_DIR = process.env.LEGACY_UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB - ID proof (image or PDF)
const MAX_PROFILE_PHOTO_SIZE = 3 * 1024 * 1024; // 3 MB - profile photo

// Target block names. `legacyNames` are the names used by the first version;
// utils/migrateBlockNames.js renames those documents IN PLACE (same _id).
const DEFAULT_BLOCKS = [
  { name: 'A Block', floors: 3, legacyNames: ['AHR Main Block'] },
  { name: 'B Block', floors: 2, legacyNames: ['Second Block'] },
  { name: 'C Block', floors: 2, legacyNames: ['Annex Block'] },
];

module.exports = {
  PG_NAME,
  ROOM_CAPACITY,
  SHARING_TYPES,
  ID_PROOF_TYPES,
  CUSTOMER_STATUS,
  PAYMENT_STATUS,
  FILE_KINDS,
  LEGACY_UPLOAD_DIR,
  MAX_FILE_SIZE,
  MAX_PROFILE_PHOTO_SIZE,
  DEFAULT_BLOCKS,
};

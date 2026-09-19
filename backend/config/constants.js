const path = require('path');

const ROOM_CAPACITY = { Single: 1, '2 in 1': 2, '3 in 1': 3 };
const SHARING_TYPES = { '1 Sharing': 1, '2 Sharing': 2, '3 Sharing': 3 };
const ID_PROOF_TYPES = ['Aadhaar Card', 'Driving License', 'Passport', 'Voter ID', 'Other'];
const CUSTOMER_STATUS = { ACTIVE: 'Active', CHECKED_OUT: 'Checked Out' };
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const DEFAULT_BLOCKS = [
  { name: 'AHR Main Block', floors: 3 },
  { name: 'Second Block', floors: 2 },
  { name: 'Annex Block', floors: 2 },
];

module.exports = {
  ROOM_CAPACITY,
  SHARING_TYPES,
  ID_PROOF_TYPES,
  CUSTOMER_STATUS,
  UPLOAD_DIR,
  MAX_FILE_SIZE,
  DEFAULT_BLOCKS,
};

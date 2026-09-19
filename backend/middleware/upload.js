const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const HttpError = require('../utils/HttpError');
const { UPLOAD_DIR, MAX_FILE_SIZE } = require('../config/constants');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Extension comes from the verified mimetype, never from the user-supplied filename.
const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ALLOWED_TYPES[file.mimetype]}`),
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
  return cb(new HttpError(400, 'Invalid ID proof file. Upload a JPG, PNG, WEBP image or a PDF.'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE, files: 1 } });

module.exports = { uploadIdProof: upload.single('idProofFile') };

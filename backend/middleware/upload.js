const multer = require('multer');
const HttpError = require('../utils/HttpError');
const { MAX_FILE_SIZE } = require('../config/constants');

// Files are held in memory just long enough to be validated (by their real
// bytes, see utils/files.js) and written to MongoDB - nothing touches the disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 2, fields: 30 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'profilePhoto' || file.fieldname === 'idProofFile') return cb(null, true);
    return cb(new HttpError(400, 'Unexpected file field.'));
  },
});

// Up to one file per field; either, both or neither may be sent.
const uploadCustomerFiles = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'idProofFile', maxCount: 1 },
]);

module.exports = { uploadCustomerFiles };

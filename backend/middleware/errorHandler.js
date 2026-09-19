const multer = require('multer');
const HttpError = require('../utils/HttpError');

const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, errors: err.errors });
  }
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. Maximum size is 5 MB.'
        : 'File upload failed. Please try again.';
    return res.status(400).json({ message });
  }
  if (err.name === 'ValidationError') {
    const errors = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    return res.status(400).json({ message: 'Please check the entered details.', errors });
  }
  if (err.name === 'CastError') {
    return res.status(404).json({ message: 'The requested record was not found.' });
  }
  if (err.code === 11000) {
    const message = err.keyPattern?.roomNumber
      ? 'Room number already exists in this block.'
      : 'A record with the same value already exists.';
    return res.status(409).json({ message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed request body.' });
  }
  console.error(err);
  return res.status(500).json({ message: 'Something went wrong on the server.' });
};

module.exports = { notFound, errorHandler };

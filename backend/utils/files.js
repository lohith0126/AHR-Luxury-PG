const fs = require('fs');
const path = require('path');
const { UPLOAD_DIR } = require('../config/constants');

// Best-effort removal of an uploaded file (used when a request fails or a file is replaced).
const removeUploadedFile = async (filename) => {
  if (!filename) return;
  try {
    await fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(filename)));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Could not remove file:', err.message);
  }
};

module.exports = { removeUploadedFile };

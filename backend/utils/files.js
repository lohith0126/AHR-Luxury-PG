const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const StoredFile = require('../models/StoredFile');
const HttpError = require('./HttpError');
const { detectContentType } = require('./fileSignature');
const { LEGACY_UPLOAD_DIR } = require('../config/constants');

const OBJECT_ID_REF = /^[0-9a-f]{24}$/i;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ID_PROOF_TYPES_ALLOWED = [...IMAGE_TYPES, 'application/pdf'];

const isStoredRef = (ref) => typeof ref === 'string' && OBJECT_ID_REF.test(ref);

/**
 * Validates an uploaded multer file (memory storage) and returns a record ready to store.
 * The type is decided from the file's own bytes, not from the name/mimetype the client sent.
 */
const prepareUpload = (file, { kind, field, allowedTypes, maxBytes, typeMessage, sizeMessage }) => {
  if (!file) return null;
  if (file.size > maxBytes) throw new HttpError(400, sizeMessage, { [field]: sizeMessage });
  const contentType = detectContentType(file.buffer);
  if (!contentType || !allowedTypes.includes(contentType)) {
    throw new HttpError(400, typeMessage, { [field]: typeMessage });
  }
  return {
    kind,
    contentType,
    size: file.size,
    originalName: path.basename(file.originalname || '').slice(0, 120),
    data: file.buffer,
  };
};

/** Saves a prepared upload and returns its id (the value kept on the customer). */
const storeFile = async (prepared) => {
  const doc = await StoredFile.create(prepared);
  return String(doc._id);
};

/** Removes a stored file, or best-effort deletes a legacy disk file. Never throws. */
const removeFile = async (ref) => {
  if (!ref) return;
  try {
    if (isStoredRef(ref)) await StoredFile.deleteOne({ _id: ref });
    else await fs.promises.unlink(path.join(LEGACY_UPLOAD_DIR, path.basename(ref)));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Could not remove file:', err.message);
  }
};

const legacyPath = (ref) => path.join(LEGACY_UPLOAD_DIR, path.basename(ref));

/** Returns { contentType, data } for a stored or legacy reference, or null if the file no longer exists. */
const loadFile = async (ref) => {
  if (!ref) return null;
  if (isStoredRef(ref)) {
    if (!mongoose.isValidObjectId(ref)) return null;
    const doc = await StoredFile.findById(ref).select('contentType data').lean();
    return doc ? { contentType: doc.contentType, data: doc.data.buffer ? Buffer.from(doc.data.buffer) : doc.data } : null;
  }
  try {
    const data = await fs.promises.readFile(legacyPath(ref));
    const contentType = detectContentType(data);
    return contentType ? { contentType, data } : null;
  } catch {
    return null;
  }
};

/** Light-weight facts about a file (no bytes): used by the UI to show image vs PDF, or "missing". */
const describeFile = async (ref) => {
  if (!ref) return { available: false, contentType: null, originalName: '' };
  if (isStoredRef(ref)) {
    const doc = await StoredFile.findById(ref).select('contentType originalName size').lean();
    return doc
      ? { available: true, contentType: doc.contentType, originalName: doc.originalName, size: doc.size }
      : { available: false, contentType: null, originalName: '' };
  }
  const ext = path.extname(ref).toLowerCase();
  const byExt = { '.pdf': 'application/pdf', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
  return { available: fs.existsSync(legacyPath(ref)), contentType: byExt[ext] || null, originalName: path.basename(ref) };
};

module.exports = {
  IMAGE_TYPES,
  ID_PROOF_TYPES_ALLOWED,
  isStoredRef,
  prepareUpload,
  storeFile,
  removeFile,
  loadFile,
  describeFile,
  legacyPath,
};

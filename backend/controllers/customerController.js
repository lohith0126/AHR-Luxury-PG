const mongoose = require('mongoose');
const Room = require('../models/Room');
const Customer = require('../models/Customer');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { countActiveInRoom } = require('../utils/occupancy');
const { nextRentHistory, summarizeRent } = require('../utils/rent');
const {
  IMAGE_TYPES,
  ID_PROOF_TYPES_ALLOWED,
  prepareUpload,
  storeFile,
  removeFile,
  loadFile,
  describeFile,
} = require('../utils/files');
const {
  SHARING_TYPES,
  ID_PROOF_TYPES,
  CUSTOMER_STATUS,
  FILE_KINDS,
  MAX_FILE_SIZE,
  MAX_PROFILE_PHOTO_SIZE,
} = require('../config/constants');

const CUSTOMER_POPULATE = [
  { path: 'blockId', select: 'name' },
  { path: 'roomId', select: 'roomNumber roomType capacity' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^(?:\+91|91|0)?([6-9]\d{9})$/;
const ROOM_FULL_MESSAGE = 'Room is already full.';

const text = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeBody = (body) => ({
  fullName: text(body.fullName),
  mobile: text(body.mobile),
  email: text(body.email).toLowerCase(),
  blockId: text(body.blockId),
  roomId: text(body.roomId),
  sharingType: text(body.sharingType),
  dateOfJoining: text(body.dateOfJoining),
  expectedCheckoutDate: text(body.expectedCheckoutDate),
  idProofType: text(body.idProofType),
  idNumber: text(body.idNumber),
  monthlyRent: text(body.monthlyRent),
  securityDeposit: text(body.securityDeposit),
});

const isValidDate = (value) => !Number.isNaN(new Date(value).getTime());

const photoRules = {
  kind: FILE_KINDS.PROFILE_PHOTO,
  field: 'profilePhoto',
  allowedTypes: IMAGE_TYPES,
  maxBytes: MAX_PROFILE_PHOTO_SIZE,
  typeMessage: 'Profile photo must be a JPG, PNG or WEBP image.',
  sizeMessage: 'Photo is too large. Maximum size is 3 MB.',
};
const idProofRules = {
  kind: FILE_KINDS.ID_PROOF,
  field: 'idProofFile',
  allowedTypes: ID_PROOF_TYPES_ALLOWED,
  maxBytes: MAX_FILE_SIZE,
  typeMessage: 'Invalid ID proof file. Upload a JPG, PNG, WEBP image or a PDF.',
  sizeMessage: 'File is too large. Maximum size is 5 MB.',
};

/** Validates raw input. Returns cleaned values or throws a 400 with per-field errors. */
const validateCustomer = (raw, hasIdFile) => {
  const data = normalizeBody(raw);
  const errors = {};

  if (!data.fullName) errors.fullName = 'Full name is required.';
  else if (data.fullName.length > 100) errors.fullName = 'Full name is too long.';

  const mobileMatch = data.mobile.replace(/[\s-]/g, '').match(MOBILE_REGEX);
  if (!data.mobile) errors.mobile = 'Mobile number is required.';
  else if (!mobileMatch) errors.mobile = 'Enter a valid 10-digit mobile number.';

  if (data.email && !EMAIL_REGEX.test(data.email)) errors.email = 'Enter a valid email address.';

  if (!data.blockId || !mongoose.isValidObjectId(data.blockId)) errors.blockId = 'Select a building.';
  if (!data.roomId || !mongoose.isValidObjectId(data.roomId)) errors.roomId = 'Select a room.';
  if (!SHARING_TYPES[data.sharingType]) errors.sharingType = 'Select a sharing type.';

  if (!data.dateOfJoining) errors.dateOfJoining = 'Date of joining is required.';
  else if (!isValidDate(data.dateOfJoining)) errors.dateOfJoining = 'Enter a valid joining date.';

  if (data.expectedCheckoutDate) {
    if (!isValidDate(data.expectedCheckoutDate)) {
      errors.expectedCheckoutDate = 'Enter a valid check-out date.';
    } else if (
      !errors.dateOfJoining &&
      new Date(data.expectedCheckoutDate) < new Date(data.dateOfJoining)
    ) {
      errors.expectedCheckoutDate = 'Check-out date cannot be before the joining date.';
    }
  }

  if (!ID_PROOF_TYPES.includes(data.idProofType)) errors.idProofType = 'Select an ID proof type.';
  const compactId = data.idNumber.replace(/\s/g, '');
  if (!data.idNumber) errors.idNumber = 'ID number is required.';
  else if (data.idProofType === 'Aadhaar Card' && !/^\d{12}$/.test(compactId)) {
    errors.idNumber = 'Aadhaar number must be 12 digits.';
  } else if (compactId.length < 4 || compactId.length > 30) {
    errors.idNumber = 'Enter a valid ID number.';
  }
  if (!hasIdFile) errors.idProofFile = 'Upload the ID proof.';

  // Monthly rent is required and > 0. Deposit is optional and defaults to 0.
  const rent = Number(data.monthlyRent);
  if (!data.monthlyRent) errors.monthlyRent = 'Monthly rent is required.';
  else if (!Number.isFinite(rent) || rent <= 0 || rent > 1000000) {
    errors.monthlyRent = 'Monthly rent must be greater than zero.';
  }
  const deposit = data.securityDeposit === '' ? 0 : Number(data.securityDeposit);
  if (!Number.isFinite(deposit) || deposit < 0 || deposit > 10000000) {
    errors.securityDeposit = 'Enter a valid security deposit.';
  }

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Please correct the highlighted fields.', errors);
  }

  return {
    ...data,
    mobile: mobileMatch[1],
    expectedCheckoutDate: data.expectedCheckoutDate || undefined,
    monthlyRent: rent,
    securityDeposit: deposit,
  };
};

/** Confirms the room exists, belongs to the chosen block and matches the sharing type. */
const loadValidRoom = async (data) => {
  const room = await Room.findById(data.roomId);
  if (!room) throw new HttpError(404, 'Selected room does not exist.');
  if (String(room.blockId) !== data.blockId) {
    throw new HttpError(400, 'Selected room does not belong to the selected building.');
  }
  if (SHARING_TYPES[data.sharingType] !== room.capacity) {
    throw new HttpError(
      400,
      `A ${room.roomType} room only supports ${room.capacity} Sharing. Choose a matching sharing type.`
    );
  }
  return room;
};

const findCustomerOr404 = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Customer not found.');
  const customer = await Customer.findById(id);
  if (!customer) throw new HttpError(404, 'Customer not found.');
  return customer;
};

/** Customer as JSON plus file facts (image/PDF/missing) and a rent summary for the UI. */
const serialize = async (customer) => {
  await customer.populate(CUSTOMER_POPULATE);
  const plain = customer.toObject();
  const [idProofMeta, photoMeta] = await Promise.all([
    describeFile(plain.idProofFile),
    describeFile(plain.profilePhoto),
  ]);
  return {
    ...plain,
    idProofMeta,
    profilePhotoAvailable: Boolean(plain.profilePhoto) && photoMeta.available,
    rentSummary: summarizeRent(plain.rentHistory),
  };
};

const files = (req) => ({
  photo: req.files?.profilePhoto?.[0],
  idProof: req.files?.idProofFile?.[0],
});

const createCustomer = async (req, res, next) => {
  const storedRefs = []; // files written during this request, removed again if it fails
  try {
    const { photo, idProof } = files(req);
    const data = validateCustomer(req.body, Boolean(idProof));
    const photoUpload = prepareUpload(photo, photoRules);
    const idUpload = prepareUpload(idProof, idProofRules);
    const room = await loadValidRoom(data);

    if ((await countActiveInRoom(room._id)) >= room.capacity) {
      throw new HttpError(409, ROOM_FULL_MESSAGE);
    }

    const idProofFile = await storeFile(idUpload);
    storedRefs.push(idProofFile);
    let profilePhoto = '';
    if (photoUpload) {
      profilePhoto = await storeFile(photoUpload);
      storedRefs.push(profilePhoto);
    }

    const customer = await Customer.create({
      ...data,
      idProofFile,
      profilePhoto,
      rentHistory: nextRentHistory({ newRent: data.monthlyRent, joiningDate: data.dateOfJoining, isNew: true }),
    });

    // Re-check after writing: guards against two simultaneous requests taking the last bed.
    if ((await countActiveInRoom(room._id)) > room.capacity) {
      await Customer.deleteOne({ _id: customer._id });
      throw new HttpError(409, ROOM_FULL_MESSAGE);
    }

    res.status(201).json(await serialize(customer));
  } catch (err) {
    await Promise.all(storedRefs.map(removeFile));
    next(err);
  }
};

const updateCustomer = async (req, res, next) => {
  const storedRefs = [];
  try {
    const customer = await findCustomerOr404(req.params.id);
    if (customer.status !== CUSTOMER_STATUS.ACTIVE) {
      throw new HttpError(409, 'Checked-out customers cannot be edited.');
    }

    const { photo, idProof } = files(req);
    const data = validateCustomer(req.body, Boolean(idProof || customer.idProofFile));
    const photoUpload = prepareUpload(photo, photoRules);
    const idUpload = prepareUpload(idProof, idProofRules);
    const room = await loadValidRoom(data);
    const roomChanged = String(customer.roomId) !== data.roomId;

    if (roomChanged && (await countActiveInRoom(room._id, customer._id)) >= room.capacity) {
      throw new HttpError(409, ROOM_FULL_MESSAGE);
    }

    const previous = {
      blockId: customer.blockId,
      roomId: customer.roomId,
      sharingType: customer.sharingType,
      idProofFile: customer.idProofFile,
      profilePhoto: customer.profilePhoto,
    };

    // A new file is only stored if the owner explicitly picked one; otherwise the
    // existing photo / ID proof is left exactly as it is.
    const newIdRef = idUpload ? await storeFile(idUpload) : null;
    if (newIdRef) storedRefs.push(newIdRef);
    const newPhotoRef = photoUpload ? await storeFile(photoUpload) : null;
    if (newPhotoRef) storedRefs.push(newPhotoRef);

    // Rent rule: a change applies from next month; months already billed keep their amount.
    const rentHistory = nextRentHistory({
      rentHistory: customer.rentHistory.map((e) => ({ rent: e.rent, effectiveFrom: e.effectiveFrom })),
      newRent: data.monthlyRent,
      joiningDate: data.dateOfJoining,
    });

    customer.set(data);
    customer.rentHistory = rentHistory;
    if (newIdRef) customer.idProofFile = newIdRef;
    if (newPhotoRef) customer.profilePhoto = newPhotoRef;
    await customer.save();

    if (roomChanged && (await countActiveInRoom(room._id)) > room.capacity) {
      customer.set(previous);
      await customer.save();
      throw new HttpError(409, ROOM_FULL_MESSAGE);
    }

    if (newIdRef) await removeFile(previous.idProofFile);
    if (newPhotoRef && previous.profilePhoto) await removeFile(previous.profilePhoto);
    res.json(await serialize(customer));
  } catch (err) {
    await Promise.all(storedRefs.map(removeFile));
    next(err);
  }
};

const getCustomer = asyncHandler(async (req, res) => {
  res.json(await serialize(await findCustomerOr404(req.params.id)));
});

const listCustomers = asyncHandler(async (req, res) => {
  const filter = {};
  const status = text(req.query.status);
  if (Object.values(CUSTOMER_STATUS).includes(status)) filter.status = status;

  const search = text(req.query.q).slice(0, 60);
  if (search) {
    const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: pattern }, { mobile: pattern }];
  }
  const customers = await Customer.find(filter).sort({ createdAt: -1 }).populate(CUSTOMER_POPULATE);
  res.json(customers);
});

/** "Removing" a customer checks them out; the record and payment history are kept. */
const removeCustomer = asyncHandler(async (req, res) => {
  const customer = await findCustomerOr404(req.params.id);
  if (customer.status === CUSTOMER_STATUS.CHECKED_OUT) {
    throw new HttpError(409, 'Customer has already been removed.');
  }
  customer.status = CUSTOMER_STATUS.CHECKED_OUT;
  customer.actualCheckoutDate = new Date();
  await customer.save({ validateModifiedOnly: true });
  res.json({ message: 'Customer removed successfully.' });
});

/**
 * Photos and ID proofs are served ONLY through these per-customer routes - there is no
 * public /uploads folder. Responses are never cached and never sniffed. NOTE: the app has
 * no login, so these routes are exactly as private as the app's own address; see the
 * privacy notes in DELTA.md.
 */
const streamCustomerFile = (field) =>
  asyncHandler(async (req, res) => {
    const customer = await findCustomerOr404(req.params.id);
    const file = await loadFile(customer[field]);
    if (!file) throw new HttpError(404, 'File not found.');
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(file.data);
  });

module.exports = {
  createCustomer,
  updateCustomer,
  getCustomer,
  listCustomers,
  removeCustomer,
  getProfilePhoto: streamCustomerFile('profilePhoto'),
  getIdProofFile: streamCustomerFile('idProofFile'),
};

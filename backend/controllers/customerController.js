const mongoose = require('mongoose');
const Room = require('../models/Room');
const Customer = require('../models/Customer');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { removeUploadedFile } = require('../utils/files');
const { countActiveInRoom } = require('../utils/occupancy');
const { SHARING_TYPES, ID_PROOF_TYPES, CUSTOMER_STATUS } = require('../config/constants');

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
});

const isValidDate = (value) => !Number.isNaN(new Date(value).getTime());

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

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Please correct the highlighted fields.', errors);
  }

  return {
    ...data,
    mobile: mobileMatch[1],
    expectedCheckoutDate: data.expectedCheckoutDate || undefined,
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

const createCustomer = async (req, res, next) => {
  const uploaded = req.file;
  try {
    const data = validateCustomer(req.body, Boolean(uploaded));
    const room = await loadValidRoom(data);

    if ((await countActiveInRoom(room._id)) >= room.capacity) {
      throw new HttpError(409, ROOM_FULL_MESSAGE);
    }

    const customer = await Customer.create({ ...data, idProofFile: uploaded.filename });

    // Re-check after writing: guards against two simultaneous requests taking the last bed.
    if ((await countActiveInRoom(room._id)) > room.capacity) {
      await Customer.deleteOne({ _id: customer._id });
      throw new HttpError(409, ROOM_FULL_MESSAGE);
    }

    await customer.populate(CUSTOMER_POPULATE);
    res.status(201).json(customer);
  } catch (err) {
    await removeUploadedFile(uploaded?.filename);
    next(err);
  }
};

const updateCustomer = async (req, res, next) => {
  const uploaded = req.file;
  try {
    const customer = await findCustomerOr404(req.params.id);
    if (customer.status !== CUSTOMER_STATUS.ACTIVE) {
      throw new HttpError(409, 'Checked-out customers cannot be edited.');
    }

    const data = validateCustomer(req.body, Boolean(uploaded || customer.idProofFile));
    const room = await loadValidRoom(data);
    const roomChanged = String(customer.roomId) !== data.roomId;

    if (roomChanged && (await countActiveInRoom(room._id, customer._id)) >= room.capacity) {
      throw new HttpError(409, ROOM_FULL_MESSAGE);
    }

    const previous = {
      blockId: customer.blockId,
      roomId: customer.roomId,
      sharingType: customer.sharingType,
    };
    const previousFile = customer.idProofFile;

    customer.set(data);
    if (uploaded) customer.idProofFile = uploaded.filename;
    await customer.save();

    if (roomChanged && (await countActiveInRoom(room._id)) > room.capacity) {
      customer.set(previous);
      customer.idProofFile = previousFile;
      await customer.save();
      throw new HttpError(409, ROOM_FULL_MESSAGE);
    }

    if (uploaded) await removeUploadedFile(previousFile);
    await customer.populate(CUSTOMER_POPULATE);
    res.json(customer);
  } catch (err) {
    await removeUploadedFile(uploaded?.filename);
    next(err);
  }
};

const getCustomer = asyncHandler(async (req, res) => {
  const customer = await findCustomerOr404(req.params.id);
  await customer.populate(CUSTOMER_POPULATE);
  res.json(customer);
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

/** "Removing" a customer checks them out; the record is kept for history. */
const removeCustomer = asyncHandler(async (req, res) => {
  const customer = await findCustomerOr404(req.params.id);
  if (customer.status === CUSTOMER_STATUS.CHECKED_OUT) {
    throw new HttpError(409, 'Customer has already been removed.');
  }
  customer.status = CUSTOMER_STATUS.CHECKED_OUT;
  customer.actualCheckoutDate = new Date();
  await customer.save();
  res.json({ message: 'Customer removed successfully.' });
});

module.exports = {
  createCustomer,
  updateCustomer,
  getCustomer,
  listCustomers,
  removeCustomer,
};

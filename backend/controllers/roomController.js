const mongoose = require('mongoose');
const Block = require('../models/Block');
const Room = require('../models/Room');
const Customer = require('../models/Customer');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { ROOM_CAPACITY, CUSTOMER_STATUS } = require('../config/constants');
const { decorateRoom, getOccupiedCountMap, countActiveInRoom } = require('../utils/occupancy');

const CUSTOMER_POPULATE = [
  { path: 'blockId', select: 'name' },
  { path: 'roomId', select: 'roomNumber roomType capacity' },
];

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const findBlockOr404 = async (blockId) => {
  if (!mongoose.isValidObjectId(blockId)) throw new HttpError(404, 'Block not found.');
  const block = await Block.findById(blockId);
  if (!block) throw new HttpError(404, 'Block not found.');
  return block;
};

const findRoomOr404 = async (roomId) => {
  if (!mongoose.isValidObjectId(roomId)) throw new HttpError(404, 'Room not found.');
  const room = await Room.findById(roomId);
  if (!room) throw new HttpError(404, 'Room not found.');
  return room;
};

const validateRoomFields = ({ roomNumber, roomType }) => {
  const errors = {};
  if (!roomNumber) errors.roomNumber = 'Room number is required.';
  else if (roomNumber.length > 20) errors.roomNumber = 'Room number is too long.';
  if (!roomType || !ROOM_CAPACITY[roomType]) errors.roomType = 'Select a valid room type.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', errors);
};

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

const getRoomsByBlock = asyncHandler(async (req, res) => {
  await findBlockOr404(req.params.blockId);
  const rooms = await Room.find({ blockId: req.params.blockId }).lean();
  rooms.sort((a, b) => collator.compare(a.roomNumber, b.roomNumber));
  const occupiedMap = await getOccupiedCountMap(rooms.map((r) => r._id));
  res.json(rooms.map((room) => decorateRoom(room, occupiedMap.get(String(room._id)) || 0)));
});

const createRoom = asyncHandler(async (req, res) => {
  const block = await findBlockOr404(req.params.blockId);
  const data = { roomNumber: trimmed(req.body.roomNumber), roomType: trimmed(req.body.roomType) };
  validateRoomFields(data);
  const room = await Room.create({ blockId: block._id, ...data });
  res.status(201).json(decorateRoom(room, 0));
});

const getRoom = asyncHandler(async (req, res) => {
  const room = await findRoomOr404(req.params.roomId);
  await room.populate('blockId', 'name floors');
  const occupied = await countActiveInRoom(room._id);
  res.json(decorateRoom(room, occupied));
});

const updateRoom = asyncHandler(async (req, res) => {
  const room = await findRoomOr404(req.params.roomId);
  const data = {
    roomNumber: trimmed(req.body.roomNumber) || room.roomNumber,
    roomType: trimmed(req.body.roomType) || room.roomType,
  };
  validateRoomFields(data);

  const occupied = await countActiveInRoom(room._id);
  if (data.roomType !== room.roomType && occupied > 0) {
    throw new HttpError(409, 'Room type cannot be changed while customers are staying in this room.');
  }
  room.roomNumber = data.roomNumber;
  room.roomType = data.roomType;
  await room.save();
  res.json(decorateRoom(room, occupied));
});

const deleteRoom = asyncHandler(async (req, res) => {
  const room = await findRoomOr404(req.params.roomId);
  const activeCount = await countActiveInRoom(room._id);
  if (activeCount > 0) {
    throw new HttpError(409, 'This room has customers. Remove them before deleting the room.');
  }
  const historyCount = await Customer.countDocuments({ roomId: room._id });
  if (historyCount > 0) {
    throw new HttpError(409, 'This room has customer history and cannot be deleted.');
  }
  await room.deleteOne();
  res.json({ message: 'Room deleted successfully.' });
});

const getRoomCustomers = asyncHandler(async (req, res) => {
  const room = await findRoomOr404(req.params.roomId);
  const customers = await Customer.find({ roomId: room._id, status: CUSTOMER_STATUS.ACTIVE })
    .sort({ createdAt: 1 })
    .populate(CUSTOMER_POPULATE);
  res.json(customers);
});

module.exports = { getRoomsByBlock, createRoom, getRoom, updateRoom, deleteRoom, getRoomCustomers };

const mongoose = require('mongoose');
const Block = require('../models/Block');
const Room = require('../models/Room');
const Customer = require('../models/Customer');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { CUSTOMER_STATUS } = require('../config/constants');

/** Adds room / bed counts (calculated from the database) to each block. */
const withStats = async (blocks) => {
  const [roomRows, customerRows] = await Promise.all([
    Room.aggregate([{ $group: { _id: '$blockId', rooms: { $sum: 1 }, beds: { $sum: '$capacity' } } }]),
    Customer.aggregate([
      { $match: { status: CUSTOMER_STATUS.ACTIVE } },
      { $group: { _id: '$blockId', occupied: { $sum: 1 } } },
    ]),
  ]);
  const roomMap = new Map(roomRows.map((r) => [String(r._id), r]));
  const occupiedMap = new Map(customerRows.map((r) => [String(r._id), r.occupied]));

  return blocks.map((block) => {
    const key = String(block._id);
    const totalBeds = roomMap.get(key)?.beds || 0;
    const occupiedBeds = occupiedMap.get(key) || 0;
    return {
      ...block,
      roomCount: roomMap.get(key)?.rooms || 0,
      totalBeds,
      occupiedBeds,
      availableBeds: Math.max(totalBeds - occupiedBeds, 0),
    };
  });
};

const getBlocks = asyncHandler(async (req, res) => {
  const blocks = await Block.find().sort({ createdAt: 1, _id: 1 }).lean();
  res.json(await withStats(blocks));
});

const getBlock = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Block not found.');
  const block = await Block.findById(req.params.id).lean();
  if (!block) throw new HttpError(404, 'Block not found.');
  const [withCounts] = await withStats([block]);
  res.json(withCounts);
});

const createBlock = asyncHandler(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const floors = Number(req.body.floors);
  if (!name) throw new HttpError(400, 'Block name is required.');
  if (!Number.isInteger(floors) || floors < 1 || floors > 50) {
    throw new HttpError(400, 'Floors must be a whole number between 1 and 50.');
  }
  const block = await Block.create({ name, floors });
  res.status(201).json(block);
});

const getDashboard = asyncHandler(async (req, res) => {
  const [totalBlocks, totalRooms, bedRows, totalCustomers] = await Promise.all([
    Block.countDocuments(),
    Room.countDocuments(),
    Room.aggregate([{ $group: { _id: null, beds: { $sum: '$capacity' } } }]),
    Customer.countDocuments({ status: CUSTOMER_STATUS.ACTIVE }),
  ]);
  const totalBeds = bedRows[0]?.beds || 0;
  res.json({
    totalBlocks,
    totalRooms,
    totalBeds,
    totalCustomers,
    availableBeds: Math.max(totalBeds - totalCustomers, 0),
  });
});

module.exports = { getBlocks, getBlock, createBlock, getDashboard };

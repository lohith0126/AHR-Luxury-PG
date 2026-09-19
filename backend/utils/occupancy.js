const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const { CUSTOMER_STATUS } = require('../config/constants');

/** Status is always derived from capacity vs. active customers. */
const getRoomStatus = (capacity, occupied) => {
  if (occupied <= 0) return 'Available';
  if (occupied >= capacity) return 'Fully Occupied';
  return 'Partially Occupied';
};

const decorateRoom = (room, occupied = 0) => {
  const plain = typeof room.toObject === 'function' ? room.toObject() : room;
  return {
    ...plain,
    occupied,
    available: Math.max(plain.capacity - occupied, 0),
    status: getRoomStatus(plain.capacity, occupied),
  };
};

/** Map of roomId -> number of active customers, for the given room ids. */
const getOccupiedCountMap = async (roomIds) => {
  const rows = await Customer.aggregate([
    {
      $match: {
        status: CUSTOMER_STATUS.ACTIVE,
        roomId: { $in: roomIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
      },
    },
    { $group: { _id: '$roomId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
};

const countActiveInRoom = (roomId, excludeCustomerId) => {
  const filter = { roomId, status: CUSTOMER_STATUS.ACTIVE };
  if (excludeCustomerId) filter._id = { $ne: excludeCustomerId };
  return Customer.countDocuments(filter);
};

module.exports = { getRoomStatus, decorateRoom, getOccupiedCountMap, countActiveInRoom };

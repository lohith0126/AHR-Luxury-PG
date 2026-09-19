const mongoose = require('mongoose');
const { ROOM_CAPACITY } = require('../config/constants');

const roomSchema = new mongoose.Schema(
  {
    blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true, index: true },
    roomNumber: { type: String, required: [true, 'Room number is required.'], trim: true },
    roomType: { type: String, required: true, enum: Object.keys(ROOM_CAPACITY) },
    // Derived from roomType. Occupancy is never stored - it is computed from active customers.
    capacity: { type: Number, required: true, min: 1, max: 3 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

roomSchema.pre('validate', function setCapacity(next) {
  if (this.roomType && ROOM_CAPACITY[this.roomType]) {
    this.capacity = ROOM_CAPACITY[this.roomType];
  }
  next();
});

// A room number must be unique inside its block.
roomSchema.index({ blockId: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);

const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Block name is required.'], trim: true, unique: true },
    floors: { type: Number, required: [true, 'Number of floors is required.'], min: 1, default: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Block', blockSchema);

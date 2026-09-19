const Block = require('../models/Block');
const { DEFAULT_BLOCKS } = require('../config/constants');

/** Inserts the three default blocks that do not exist yet. Safe to run repeatedly. */
const seedBlocks = async () => {
  let created = 0;
  for (const block of DEFAULT_BLOCKS) {
    const exists = await Block.exists({ name: block.name });
    if (!exists) {
      await Block.create(block);
      created += 1;
    }
  }
  return created;
};

module.exports = seedBlocks;

const Block = require('../models/Block');
const { DEFAULT_BLOCKS } = require('../config/constants');

/**
 * Creates A / B / C Block ONLY on a completely empty database. If any block already
 * exists (e.g. your live data) this does nothing, so it can never create duplicates
 * next to existing blocks that have a different name.
 */
const seedBlocks = async () => {
  if ((await Block.estimatedDocumentCount()) > 0) return 0;
  await Block.insertMany(DEFAULT_BLOCKS.map(({ name, floors }) => ({ name, floors })));
  return DEFAULT_BLOCKS.length;
};

module.exports = seedBlocks;

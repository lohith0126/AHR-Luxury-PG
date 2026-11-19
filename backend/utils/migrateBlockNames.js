const Block = require('../models/Block');
const { DEFAULT_BLOCKS } = require('../config/constants');

/**
 * Renames blocks from the first version's names to A / B / C Block.
 * SAFE: renames the existing document IN PLACE, so its _id - which every Room and
 * Customer points to - never changes. Never creates, deletes or duplicates anything,
 * and is harmless to run any number of times.
 * With { dryRun: true } nothing is written; the planned changes are returned.
 */
const migrateBlockNames = async ({ dryRun = false } = {}) => {
  const changes = [];
  for (const target of DEFAULT_BLOCKS) {
    if (await Block.exists({ name: target.name })) continue;
    const legacy = await Block.findOne({ name: { $in: target.legacyNames } });
    if (!legacy) continue;
    changes.push({ id: String(legacy._id), from: legacy.name, to: target.name });
    if (!dryRun) {
      legacy.name = target.name;
      await legacy.save();
    }
  }

  const names = (await Block.find().select('name').lean()).map((b) => b.name);
  const unexpected = names.filter((n) => !DEFAULT_BLOCKS.some((b) => b.name === n));
  const missing = DEFAULT_BLOCKS.map((b) => b.name).filter((n) => !names.includes(n));
  return { changes, unexpected, missing };
};

module.exports = migrateBlockNames;

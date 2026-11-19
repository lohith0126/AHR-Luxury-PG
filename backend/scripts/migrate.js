// Usage:  npm run migrate -- --dry-run     (shows what WOULD change, writes nothing)
//         npm run migrate                  (applies the changes)
// Safe to run repeatedly. Never deletes data. Take a backup first (see DELTA.md).
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Block = require('../models/Block');
const Room = require('../models/Room');
const Customer = require('../models/Customer');
const migrateBlockNames = require('../utils/migrateBlockNames');
const seedBlocks = require('../utils/seedBlocks');
const importLegacyFiles = require('../utils/importLegacyFiles');

const dryRun = process.argv.includes('--dry-run');

const counts = async () => ({
  blocks: await Block.countDocuments(),
  rooms: await Room.countDocuments(),
  customers: await Customer.countDocuments(),
});

(async () => {
  try {
    await connectDB();
    console.log(dryRun ? '*** DRY RUN - nothing will be written ***' : '*** APPLYING MIGRATION ***');
    const before = await counts();
    console.log('Counts before:', before);

    const blocks = await migrateBlockNames({ dryRun });
    blocks.changes.forEach((c) => console.log(`Block ${c.id}: "${c.from}" -> "${c.to}"`));
    if (!blocks.changes.length) console.log('Blocks: nothing to rename.');
    if (blocks.unexpected.length) console.log('Blocks with other names (left untouched):', blocks.unexpected);
    if (blocks.missing.length) console.log('Target names not present:', blocks.missing);

    if (!dryRun) {
      const seeded = await seedBlocks();
      if (seeded) console.log(`Empty database: created ${seeded} blocks.`);
    }

    const files = await importLegacyFiles({ dryRun });
    console.log(`ID proofs on old disk storage: ${files.found}; ${dryRun ? 'importable' : 'imported'}: ${files.imported}; missing on disk: ${files.missing.length}`);
    files.missing.slice(0, 20).forEach((m) => console.log(`  - ${m.name} (${m.id}): ${m.file}`));

    const after = await counts();
    console.log('Counts after: ', after);
    if (JSON.stringify(before) !== JSON.stringify(after) && !dryRun) {
      console.log('NOTE: counts changed - expected only on an empty database. Compare with your backup.');
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();

// Usage: npm run seed  - creates the three default blocks if they are missing.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const seedBlocks = require('./utils/seedBlocks');

(async () => {
  try {
    await connectDB();
    const created = await seedBlocks();
    console.log(created ? `Created ${created} block(s).` : 'Blocks already exist. Nothing to do.');
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();

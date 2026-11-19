// Usage: npm run init-month [YYYY-MM]
// Creates any missing "Due" payment records for the month (default: current month).
// Idempotent. Optional: run it from a Render Cron Job on the 1st of every month. The app
// also does this on demand, so skipping the cron job loses nothing.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { ensureMonthInitialized } = require('../utils/ensureMonthInitialized');
const { currentBillingMonth, isValidBillingMonth } = require('../utils/billingMonth');

(async () => {
  try {
    const month = process.argv[2] || currentBillingMonth();
    if (!isValidBillingMonth(month)) throw new Error('Month must be YYYY-MM');
    await connectDB();
    const result = await ensureMonthInitialized(month);
    console.log(`${month}: ${result.eligible} customer(s) billed, ${result.created} new Due record(s) created.`);
  } catch (err) {
    console.error('init-month failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();

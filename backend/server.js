require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const seedBlocks = require('./utils/seedBlocks');
const migrateBlockNames = require('./utils/migrateBlockNames');
const importLegacyFiles = require('./utils/importLegacyFiles');
const { ensureMonthInitialized } = require('./utils/ensureMonthInitialized');
const { currentBillingMonth } = require('./utils/billingMonth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

// There is deliberately NO static /uploads folder any more. Profile photos and ID proofs
// are stored in MongoDB and only served by the per-customer routes in customerRoutes.js.

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/blocks', require('./routes/blockRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

app.use(notFound);
app.use(errorHandler);

/** Idempotent, non-destructive startup tasks. Order matters: rename BEFORE seeding. */
const runStartupTasks = async () => {
  const { changes, unexpected, missing } = await migrateBlockNames();
  changes.forEach((c) => console.log(`Renamed block "${c.from}" -> "${c.to}" (id ${c.id})`));
  if (unexpected.length || missing.length) {
    console.warn(`Block names differ from A/B/C Block. Unexpected: [${unexpected}] Missing: [${missing}]`);
  }
  const seeded = await seedBlocks();
  if (seeded) console.log(`Empty database: created ${seeded} default blocks.`);

  const legacy = await importLegacyFiles();
  if (legacy.found) {
    console.log(`Legacy ID proofs: ${legacy.imported} imported, ${legacy.missing.length} missing on disk.`);
  }
};

const start = async () => {
  try {
    await connectDB();
    await runStartupTasks();
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

    // Warm up the current month's Due records. Never blocks or crashes startup; the
    // Payments page also creates them on demand, so a missed run loses nothing.
    ensureMonthInitialized(currentBillingMonth())
      .then((r) => console.log(`Billing month ${currentBillingMonth()}: ${r.created} new Due record(s).`))
      .catch((err) => console.error('Month initialization skipped:', err.message));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

start();

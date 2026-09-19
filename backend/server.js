require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const seedBlocks = require('./utils/seedBlocks');
const { UPLOAD_DIR } = require('./config/constants');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/blocks', require('./routes/blockRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  try {
    await connectDB();
    const created = await seedBlocks();
    if (created) console.log(`Seeded ${created} default block(s).`);
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

start();

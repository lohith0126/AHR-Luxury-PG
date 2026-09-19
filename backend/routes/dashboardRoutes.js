const express = require('express');
const { getDashboard } = require('../controllers/blockController');

const router = express.Router();

router.get('/', getDashboard);

module.exports = router;

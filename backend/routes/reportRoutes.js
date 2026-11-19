const express = require('express');
const { downloadReport } = require('../controllers/reportController');

const router = express.Router();

router.get('/', downloadReport);

module.exports = router;

const express = require('express');
const { getMonthlyPayments, updatePaymentStatus } = require('../controllers/paymentController');

const router = express.Router();

router.get('/', getMonthlyPayments);
router.patch('/:id', updatePaymentStatus);

module.exports = router;

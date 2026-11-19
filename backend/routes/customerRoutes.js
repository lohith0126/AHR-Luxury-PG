const express = require('express');
const { uploadCustomerFiles } = require('../middleware/upload');
const {
  createCustomer,
  updateCustomer,
  getCustomer,
  listCustomers,
  removeCustomer,
  getProfilePhoto,
  getIdProofFile,
} = require('../controllers/customerController');
const { getCustomerPaymentHistory } = require('../controllers/paymentController');

const router = express.Router();

router.route('/').get(listCustomers).post(uploadCustomerFiles, createCustomer);
router.route('/:id').get(getCustomer).put(uploadCustomerFiles, updateCustomer).delete(removeCustomer);

router.get('/:id/payments', getCustomerPaymentHistory);
router.get('/:id/profile-photo', getProfilePhoto);
router.get('/:id/id-proof', getIdProofFile);

module.exports = router;

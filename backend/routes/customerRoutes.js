const express = require('express');
const { uploadIdProof } = require('../middleware/upload');
const {
  createCustomer,
  updateCustomer,
  getCustomer,
  listCustomers,
  removeCustomer,
} = require('../controllers/customerController');

const router = express.Router();

router.route('/').get(listCustomers).post(uploadIdProof, createCustomer);
router.route('/:id').get(getCustomer).put(uploadIdProof, updateCustomer).delete(removeCustomer);

module.exports = router;

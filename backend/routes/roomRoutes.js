const express = require('express');
const {
  getRoom,
  updateRoom,
  deleteRoom,
  getRoomCustomers,
} = require('../controllers/roomController');

const router = express.Router();

router.route('/:roomId').get(getRoom).put(updateRoom).delete(deleteRoom);
router.get('/:roomId/customers', getRoomCustomers);

module.exports = router;

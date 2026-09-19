const express = require('express');
const { getBlocks, getBlock, createBlock } = require('../controllers/blockController');
const { getRoomsByBlock, createRoom } = require('../controllers/roomController');

const router = express.Router();

router.route('/').get(getBlocks).post(createBlock);
router.route('/:blockId/rooms').get(getRoomsByBlock).post(createRoom);
router.get('/:id', getBlock);

module.exports = router;

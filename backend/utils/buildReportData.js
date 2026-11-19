const Block = require('../models/Block');
const Room = require('../models/Room');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const { ensureMonthInitialized } = require('./ensureMonthInitialized');
const { currentBillingMonth, formatBillingMonthLabel } = require('./billingMonth');
const { rentForMonth } = require('./rent');
const { PG_NAME, CUSTOMER_STATUS, PAYMENT_STATUS } = require('../config/constants');

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);

const roomStatus = (capacity, occupied) =>
  occupied <= 0 ? 'Available' : occupied >= capacity ? 'Fully Occupied' : 'Partially Occupied';

/**
 * Gathers everything for a report from MongoDB.
 *  - Rooms / occupancy / customers  => CURRENT situation, at the time of generation.
 *  - Payments                        => HISTORICAL billing records of the chosen month.
 * Every room belongs to exactly one block and every customer to exactly one room, and the
 * overall figures are sums of the per-block figures, so nothing is counted twice.
 * `block` is a Block document for a block report, or null for the overall PG report.
 */
const buildReportData = async ({ block, month }) => {
  const blocks = block
    ? [block]
    : (await Block.find().sort({ createdAt: 1, _id: 1 }).lean());
  const blockIds = blocks.map((b) => b._id);

  await ensureMonthInitialized(month, block ? { blockId: block._id } : {});

  const [rooms, customers, payments] = await Promise.all([
    Room.find({ blockId: { $in: blockIds } }).lean(),
    Customer.find({ blockId: { $in: blockIds }, status: CUSTOMER_STATUS.ACTIVE }).lean(),
    Payment.find({ billingMonth: month, blockId: { $in: blockIds } })
      .populate([
        { path: 'customerId', select: 'fullName' },
        { path: 'roomId', select: 'roomNumber' },
      ])
      .lean(),
  ]);

  const today = currentBillingMonth();
  const customersByRoom = new Map();
  customers.forEach((c) => {
    const key = String(c.roomId);
    if (!customersByRoom.has(key)) customersByRoom.set(key, []);
    customersByRoom.get(key).push(c);
  });

  const blockSections = blocks.map((b) => {
    const blockRooms = rooms
      .filter((r) => String(r.blockId) === String(b._id))
      .sort((x, y) => collator.compare(x.roomNumber, y.roomNumber))
      .map((room) => {
        const occupants = (customersByRoom.get(String(room._id)) || []).sort((x, y) =>
          collator.compare(x.fullName, y.fullName)
        );
        return {
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          capacity: room.capacity,
          occupied: occupants.length,
          available: Math.max(room.capacity - occupants.length, 0),
          status: roomStatus(room.capacity, occupants.length),
          customers: occupants.map((c) => ({
            fullName: c.fullName,
            mobile: c.mobile,
            sharingType: c.sharingType,
            dateOfJoining: c.dateOfJoining,
            monthlyRent: rentForMonth(c.rentHistory, today), // rent applying this month; null = not set yet
            securityDeposit: c.securityDeposit || 0,
          })),
        };
      });

    const occupiedBeds = sum(blockRooms, (r) => r.occupied);
    const totalCapacity = sum(blockRooms, (r) => r.capacity);
    return {
      name: b.name,
      totalRooms: blockRooms.length,
      totalCapacity,
      occupiedBeds,
      availableBeds: Math.max(totalCapacity - occupiedBeds, 0),
      activeCustomers: occupiedBeds,
      rooms: blockRooms,
    };
  });

  const blockNameById = new Map(blocks.map((b) => [String(b._id), b.name]));
  const paymentRows = payments
    .map((p) => ({
      blockName: blockNameById.get(String(p.blockId)) || '—',
      roomNumber: p.roomId?.roomNumber || '—',
      customerName: p.customerId?.fullName || 'Unknown customer',
      rentAmount: p.rentAmount,
      status: p.status,
      paidOn: p.paidOn,
    }))
    .sort(
      (a, b) =>
        collator.compare(a.blockName, b.blockName) ||
        collator.compare(a.roomNumber, b.roomNumber) ||
        collator.compare(a.customerName, b.customerName)
    );

  const paymentSummary = (rows) => {
    const paid = rows.filter((r) => r.status === PAYMENT_STATUS.PAID);
    const due = rows.filter((r) => r.status === PAYMENT_STATUS.DUE);
    return {
      totalCustomers: rows.length,
      paidCount: paid.length,
      dueCount: due.length,
      rentCollected: sum(paid, (r) => r.rentAmount),
      rentPending: sum(due, (r) => r.rentAmount),
    };
  };

  return {
    pgName: PG_NAME,
    scopeLabel: block ? block.name : 'Overall PG',
    isOverall: !block,
    generatedAt: new Date(),
    billingMonth: month,
    billingMonthLabel: formatBillingMonthLabel(month),
    occupancy: {
      totalRooms: sum(blockSections, (b) => b.totalRooms),
      totalCapacity: sum(blockSections, (b) => b.totalCapacity),
      occupiedBeds: sum(blockSections, (b) => b.occupiedBeds),
      availableBeds: sum(blockSections, (b) => b.availableBeds),
      activeCustomers: sum(blockSections, (b) => b.activeCustomers),
    },
    blocks: blockSections,
    payments: {
      summary: paymentSummary(paymentRows),
      byBlock: blocks.map((b) => ({
        blockName: b.name,
        ...paymentSummary(paymentRows.filter((r) => r.blockName === b.name)),
      })),
      rows: paymentRows,
    },
  };
};

module.exports = buildReportData;

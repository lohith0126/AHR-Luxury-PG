const mongoose = require('mongoose');
const Block = require('../models/Block');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const buildReportData = require('../utils/buildReportData');
const { buildXlsx, buildPdf, reportFileName } = require('../utils/reportGenerator');
const { isValidBillingMonth, currentBillingMonth } = require('../utils/billingMonth');

const FORMATS = {
  xlsx: { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', build: buildXlsx },
  pdf: { type: 'application/pdf', build: buildPdf },
};

/**
 * GET /api/reports?format=pdf|xlsx&month=YYYY-MM&blockId=<id>
 * No blockId = Overall PG report (all blocks). The whole file is built in memory first,
 * so a failure returns a normal JSON error instead of a half-written download.
 */
const downloadReport = asyncHandler(async (req, res) => {
  const format = String(req.query.format || '').toLowerCase();
  if (!FORMATS[format]) throw new HttpError(400, 'Report format must be pdf or xlsx.');

  const month = req.query.month ? String(req.query.month) : currentBillingMonth();
  if (!isValidBillingMonth(month)) throw new HttpError(400, 'Month must be in YYYY-MM format.');

  let block = null;
  if (req.query.blockId) {
    if (!mongoose.isValidObjectId(req.query.blockId)) throw new HttpError(404, 'Block not found.');
    block = await Block.findById(req.query.blockId).lean();
    if (!block) throw new HttpError(404, 'Block not found.');
  }

  const report = await buildReportData({ block, month });
  const file = await FORMATS[format].build(report);

  res.set({
    'Content-Type': FORMATS[format].type,
    'Content-Disposition': `attachment; filename="${reportFileName(report, format)}"`,
    'Content-Length': file.length,
    'Cache-Control': 'no-store',
  });
  res.send(file);
});

module.exports = { downloadReport };

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const NAVY = '#0a1224';
const GOLD = '#f2b632';
const GREEN = '#1a8f4c';
const RED = '#c62d2d';

const IST = 'Asia/Kolkata';
const formatGenerated = (d) => d.toLocaleString('en-IN', { timeZone: IST, dateStyle: 'medium', timeStyle: 'short' });
const formatDay = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
const formatPaidOn = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { timeZone: IST, day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const inr = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const rentText = (n) => (n == null ? 'Not set' : inr(n));

const safeName = (value) => String(value).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
const reportFileName = (report, extension) =>
  `AHR-PG-Report-${safeName(report.scopeLabel)}-${report.billingMonth}.${extension}`;

const NOTE_OCCUPANCY = (r) =>
  `Rooms, occupancy and customer details show the CURRENT situation as on ${formatGenerated(r.generatedAt)}.`;
const NOTE_PAYMENTS = (r) =>
  `Payment figures are the billing records of ${r.billingMonthLabel} only; they are separate from current occupancy.`;

/** Rows for the occupancy summary table (one per block, plus a total row for the overall report). */
const occupancyRows = (report) => {
  const rows = report.blocks.map((b) => [b.name, b.totalRooms, b.totalCapacity, b.occupiedBeds, b.availableBeds, b.activeCustomers]);
  if (report.isOverall) {
    const o = report.occupancy;
    rows.push(['Total', o.totalRooms, o.totalCapacity, o.occupiedBeds, o.availableBeds, o.activeCustomers]);
  }
  return rows;
};

const paymentSummaryRows = (report) => {
  const row = (name, s) => [name, s.totalCustomers, s.paidCount, s.dueCount, s.rentCollected, s.rentPending];
  const rows = report.payments.byBlock.map((b) => row(b.blockName, b));
  if (report.isOverall) rows.push(row('Total', report.payments.summary));
  return rows;
};

/** One row per customer; a room with nobody in it still gets a row. */
const roomCustomerRows = (report) => {
  const rows = [];
  report.blocks.forEach((block) => {
    block.rooms.forEach((room) => {
      const base = [block.name, room.roomNumber, room.roomType, room.capacity, room.occupied, room.available];
      if (room.customers.length === 0) rows.push([...base, '— vacant —', '', '', null, null]);
      room.customers.forEach((c) =>
        rows.push([...base, c.fullName, c.mobile, c.sharingType, c.monthlyRent, c.securityDeposit])
      );
    });
  });
  return rows;
};

const paymentDetailRows = (report) =>
  report.payments.rows.map((p) => [p.blockName, p.roomNumber, p.customerName, p.rentAmount, p.status, formatPaidOn(p.paidOn)]);

/* ------------------------------- Excel ------------------------------- */

const styleHeader = (row) => {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFF2B632' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1224' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
};

const buildXlsx = async (report) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = report.pgName;
  workbook.created = report.generatedAt;
  const money = '"₹"#,##0';

  /* Sheet 1: Summary */
  const summary = workbook.addWorksheet('Summary');
  [28, 16, 18, 16, 16, 18].forEach((w, i) => { summary.getColumn(i + 1).width = w; });
  summary.addRow([report.pgName]).font = { bold: true, size: 16 };
  summary.addRow([`Report: ${report.scopeLabel}`]).font = { bold: true, size: 12 };
  summary.addRow([`Billing month: ${report.billingMonthLabel}`]);
  summary.addRow([`Generated on: ${formatGenerated(report.generatedAt)}`]);
  summary.addRow([]);

  summary.addRow(['CURRENT OCCUPANCY']).font = { bold: true, size: 12 };
  summary.addRow([NOTE_OCCUPANCY(report)]).font = { italic: true, color: { argb: 'FF666666' } };
  styleHeader(summary.addRow(['Block', 'Rooms', 'Total Capacity', 'Occupied Beds', 'Available Beds', 'Active Customers']));
  const occ = occupancyRows(report);
  occ.forEach((r, i) => {
    const row = summary.addRow(r);
    if (report.isOverall && i === occ.length - 1) row.font = { bold: true };
  });
  summary.addRow([]);

  summary.addRow([`MONTHLY PAYMENT SUMMARY - ${report.billingMonthLabel.toUpperCase()}`]).font = { bold: true, size: 12 };
  summary.addRow([NOTE_PAYMENTS(report)]).font = { italic: true, color: { argb: 'FF666666' } };
  styleHeader(summary.addRow(['Block', 'Customers', 'Paid', 'Due', 'Rent Collected', 'Rent Pending']));
  const pay = paymentSummaryRows(report);
  pay.forEach((r, i) => {
    const row = summary.addRow(r);
    row.getCell(5).numFmt = money;
    row.getCell(6).numFmt = money;
    if (report.isOverall && i === pay.length - 1) row.font = { bold: true };
  });

  /* Sheet 2: Rooms & Customers */
  const rooms = workbook.addWorksheet('Rooms & Customers', { views: [{ state: 'frozen', ySplit: 1 }] });
  [14, 10, 10, 10, 10, 10, 28, 15, 12, 16, 16].forEach((w, i) => { rooms.getColumn(i + 1).width = w; });
  styleHeader(rooms.addRow(['Block', 'Room', 'Type', 'Capacity', 'Occupied', 'Available', 'Customer', 'Mobile', 'Sharing', 'Monthly Rent', 'Security Deposit']));
  roomCustomerRows(report).forEach((r) => {
    const row = rooms.addRow([...r.slice(0, 9), r[9] == null ? (r[6] === '— vacant —' ? '' : 'Not set') : r[9], r[10] == null ? '' : r[10]]);
    row.getCell(10).numFmt = money;
    row.getCell(11).numFmt = money;
  });
  rooms.addRow([]);
  rooms.addRow([NOTE_OCCUPANCY(report)]).font = { italic: true, color: { argb: 'FF666666' } };

  /* Sheet 3: Payments for the month */
  const payments = workbook.addWorksheet(`Payments ${report.billingMonth}`, { views: [{ state: 'frozen', ySplit: 1 }] });
  [14, 10, 28, 16, 12, 14].forEach((w, i) => { payments.getColumn(i + 1).width = w; });
  styleHeader(payments.addRow(['Block', 'Room', 'Customer', 'Monthly Rent', 'Status', 'Paid On']));
  paymentDetailRows(report).forEach((r) => {
    const row = payments.addRow(r);
    row.getCell(4).numFmt = money;
    row.getCell(5).font = { bold: true, color: { argb: r[4] === 'Paid' ? 'FF1A8F4C' : 'FFC62D2D' } };
  });
  payments.addRow([]);
  payments.addRow([NOTE_PAYMENTS(report)]).font = { italic: true, color: { argb: 'FF666666' } };

  return Buffer.from(await workbook.xlsx.writeBuffer());
};

/* -------------------------------- PDF -------------------------------- */

const buildPdf = (report) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const usableWidth = doc.page.width - left - doc.page.margins.right;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 8;
    let y = 0;

    const fit = (value, width) => {
      let s = String(value ?? '');
      if (doc.widthOfString(s) <= width - 8) return s;
      while (s.length > 1 && doc.widthOfString(`${s}...`) > width - 8) s = s.slice(0, -1);
      return `${s}...`;
    };

    const ensureSpace = (needed) => {
      if (y + needed > bottomLimit()) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    };

    const heading = (text, note) => {
      ensureSpace(60);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY).text(text, left, y, { lineBreak: false });
      y += 18;
      if (note) {
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#666666').text(note, left, y, { width: usableWidth });
        y += 14;
      }
    };

    /** columns: [{ label, width, align?, money? }]; cellColor(row, colIndex) -> optional colour. */
    const table = (columns, rows, { boldLastRow = false, cellColor } = {}) => {
      const rowH = 18;
      const total = columns.reduce((s, c) => s + c.width, 0);
      const scale = usableWidth / total;
      const cols = columns.map((c) => ({ ...c, width: c.width * scale }));

      const drawHeader = () => {
        doc.rect(left, y, usableWidth, rowH).fill(NAVY);
        let x = left;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GOLD);
        cols.forEach((c) => {
          doc.text(fit(c.label, c.width), x + 4, y + 5, { width: c.width - 8, align: c.align || 'left', lineBreak: false });
          x += c.width;
        });
        y += rowH;
      };

      ensureSpace(rowH * 2);
      drawHeader();
      rows.forEach((row, index) => {
        if (y + rowH > bottomLimit()) {
          doc.addPage();
          y = doc.page.margins.top;
          drawHeader();
        }
        if (index % 2 === 0) doc.rect(left, y, usableWidth, rowH).fill('#f1f3f8');
        const bold = boldLastRow && index === rows.length - 1;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
        let x = left;
        cols.forEach((c, i) => {
          const raw = row[i];
          const shown = c.money ? (raw == null ? '' : inr(raw)) : raw;
          doc.fillColor((cellColor && cellColor(row, i)) || '#111111');
          doc.text(fit(shown, c.width), x + 4, y + 5, { width: c.width - 8, align: c.align || 'left', lineBreak: false });
          x += c.width;
        });
        y += rowH;
      });
      if (rows.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666666').text('No records.', left + 4, y + 5, { lineBreak: false });
        y += rowH;
      }
      y += 10;
    };

    /* Header band */
    doc.rect(0, 0, doc.page.width, 78).fill(NAVY);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(GOLD).text(report.pgName, left, 18, { lineBreak: false });
    doc.font('Helvetica').fontSize(11).fillColor('#ffffff').text(`Report: ${report.scopeLabel}`, left, 46, { lineBreak: false });
    doc.fontSize(9.5).fillColor('#cfd6ea');
    doc.text(`Billing month: ${report.billingMonthLabel}`, left, 24, { width: usableWidth, align: 'right', lineBreak: false });
    doc.text(`Generated on: ${formatGenerated(report.generatedAt)}`, left, 40, { width: usableWidth, align: 'right', lineBreak: false });
    y = 96;

    heading('Current Occupancy', NOTE_OCCUPANCY(report));
    table(
      [
        { label: 'Block', width: 150 },
        { label: 'Rooms', width: 80, align: 'right' },
        { label: 'Total Capacity', width: 110, align: 'right' },
        { label: 'Occupied Beds', width: 110, align: 'right' },
        { label: 'Available Beds', width: 110, align: 'right' },
        { label: 'Active Customers', width: 120, align: 'right' },
      ],
      occupancyRows(report),
      { boldLastRow: report.isOverall }
    );

    heading(`Monthly Payment Summary - ${report.billingMonthLabel}`, NOTE_PAYMENTS(report));
    table(
      [
        { label: 'Block', width: 150 },
        { label: 'Customers', width: 80, align: 'right' },
        { label: 'Paid', width: 80, align: 'right' },
        { label: 'Due', width: 80, align: 'right' },
        { label: 'Rent Collected', width: 130, align: 'right', money: true },
        { label: 'Rent Pending', width: 130, align: 'right', money: true },
      ],
      paymentSummaryRows(report),
      { boldLastRow: report.isOverall }
    );

    heading('Rooms & Customers (current)', 'Rent shown is the monthly rent that applies this month.');
    table(
      [
        { label: 'Block', width: 62 },
        { label: 'Room', width: 40 },
        { label: 'Type', width: 48 },
        { label: 'Cap', width: 30, align: 'right' },
        { label: 'Occ', width: 30, align: 'right' },
        { label: 'Free', width: 32, align: 'right' },
        { label: 'Customer', width: 130 },
        { label: 'Mobile', width: 76 },
        { label: 'Sharing', width: 60 },
        { label: 'Monthly Rent', width: 74, align: 'right' },
        { label: 'Deposit', width: 74, align: 'right', money: true },
      ],
      roomCustomerRows(report).map((r) => [...r.slice(0, 9), r[9] == null && r[6] !== '— vacant —' ? 'Not set' : r[9] == null ? '' : inr(r[9]), r[10]])
    );

    heading(`Payments - ${report.billingMonthLabel}`);
    table(
      [
        { label: 'Block', width: 90 },
        { label: 'Room', width: 60 },
        { label: 'Customer', width: 220 },
        { label: 'Monthly Rent', width: 110, align: 'right', money: true },
        { label: 'Status', width: 80 },
        { label: 'Paid On', width: 100 },
      ],
      paymentDetailRows(report),
      { cellColor: (row, i) => (i === 4 ? (row[4] === 'Paid' ? GREEN : RED) : undefined) }
    );

    /* Page numbers */
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(i);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0; // otherwise text this low would trigger a new page
      doc.font('Helvetica').fontSize(8).fillColor('#777777');
      doc.text(`${report.pgName}  |  Page ${i + 1} of ${range.count}`, 0, doc.page.height - 26, {
        width: doc.page.width,
        align: 'center',
        lineBreak: false,
      });
      doc.page.margins.bottom = savedBottom;
    }
    doc.end();
  });

module.exports = { buildXlsx, buildPdf, reportFileName };

const ExcelJS = require('exceljs');
const KhataEntry = require('../../models/KhataEntry');
const WholesalerProfile = require('../../models/WholesalerProfile');
const { BadRequestError, NotFoundError } = require('../../utils/errors');

const BUSINESS_TYPES = Object.freeze([
  'CLOTHING',
  'GENERAL_STORE',
  'ELECTRONICS',
  'FOOTWEAR',
  'COSMETICS',
  'OTHER',
]);

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function calculateEntry(payload) {
  const entry = { ...payload, transactionType: 'PURCHASE' };
  entry.quantity = Number(entry.quantity);
  entry.purchaseRate = Number(entry.purchaseRate);
  entry.paidAmount = roundMoney(Number(entry.paidAmount || 0));
  entry.purchaseAmount = roundMoney(entry.quantity * entry.purchaseRate);
  entry.pendingAmount = roundMoney(entry.purchaseAmount - entry.paidAmount);
  entry.paymentStatus = entry.pendingAmount === 0
    ? 'PAID'
    : entry.paidAmount > 0
      ? 'PARTIAL'
      : 'PENDING';
  return entry;
}

function summarize(entries) {
  return entries.reduce((summary, entry) => {
    summary.totalPurchase += Number(entry.purchaseAmount || 0);
    summary.totalPaid += Number(entry.paidAmount || 0);
    summary.totalPending += Number(entry.pendingAmount || 0);
    return summary;
  }, { totalPurchase: 0, totalPaid: 0, totalPending: 0 });
}

function escapePdfText(value) {
  return String(value ?? '')
    .replace(/[₹]/g, 'Rs ')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function createPdf(lines) {
  const pages = [];
  for (let index = 0; index < lines.length; index += 40) pages.push(lines.slice(index, index + 40));
  if (!pages.length) pages.push([]);
  const fontId = 3 + pages.length * 2;
  const objects = new Array(fontId + 1);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`;

  pages.forEach((linesOnPage, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const commands = ['BT', '/F1 8 Tf', '28 565 Td', '13 TL'];
    linesOnPage.forEach((line) => commands.push(`(${escapePdfText(line)}) Tj`, 'T*'));
    commands.push('ET');
    const stream = commands.join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(document, 'ascii');
    document += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, 'ascii');
  document += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) document += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, 'ascii');
}

class KhataBookService {
  static async getSettings(wholesalerId) {
    const profile = await WholesalerProfile.findOne({ userId: wholesalerId })
      .select('businessName khataBook')
      .lean();
    if (!profile) throw new NotFoundError('Wholesaler profile not found.', 'WHOLESALER_PROFILE_NOT_FOUND');
    return {
      businessName: profile.businessName,
      businessType: profile.khataBook?.businessType || '',
      otherBusinessType: profile.khataBook?.otherBusinessType || '',
    };
  }

  static async updateSettings(wholesalerId, settings) {
    if (!BUSINESS_TYPES.includes(settings.businessType)) {
      throw new BadRequestError('Select a valid business type.', 'INVALID_BUSINESS_TYPE');
    }
    if (settings.businessType === 'OTHER' && !String(settings.otherBusinessType || '').trim()) {
      throw new BadRequestError('Please enter your business type.', 'BUSINESS_TYPE_REQUIRED');
    }
    const profile = await WholesalerProfile.findOneAndUpdate(
      { userId: wholesalerId },
      {
        $set: {
          'khataBook.businessType': settings.businessType,
          'khataBook.otherBusinessType': settings.businessType === 'OTHER'
            ? String(settings.otherBusinessType).trim()
            : '',
        },
      },
      { new: true, runValidators: true }
    ).select('businessName khataBook');
    if (!profile) throw new NotFoundError('Wholesaler profile not found.', 'WHOLESALER_PROFILE_NOT_FOUND');
    return {
      businessName: profile.businessName,
      businessType: profile.khataBook?.businessType || '',
      otherBusinessType: profile.khataBook?.otherBusinessType || '',
    };
  }

  static async getEntries(wholesalerId, filters = {}) {
    const query = { wholesalerId, transactionType: 'PURCHASE' };
    if (filters.from || filters.to) {
      query.date = {};
      if (filters.from) query.date.$gte = filters.from;
      if (filters.to) query.date.$lte = filters.to;
    }
    if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
    if (filters.counterparty) {
      const safeCounterparty = filters.counterparty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.counterpartyName = new RegExp(safeCounterparty, 'i');
    }
    if (filters.search) {
      const safeSearch = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { productName: new RegExp(safeSearch, 'i') },
        { category: new RegExp(safeSearch, 'i') },
        { counterpartyName: new RegExp(safeSearch, 'i') },
        { brandModel: new RegExp(safeSearch, 'i') },
        { notes: new RegExp(safeSearch, 'i') },
      ];
    }
    const items = await KhataEntry.find(query).sort({ date: -1, createdAt: -1 }).lean();
    return { items, summary: summarize(items) };
  }

  static async createEntry(wholesalerId, payload) {
    const entry = calculateEntry(payload);
    if (entry.paidAmount > entry.purchaseAmount) {
      throw new BadRequestError('Paid amount cannot exceed total cost.', 'PAID_AMOUNT_EXCEEDS_TOTAL');
    }
    return KhataEntry.create({ ...entry, wholesalerId });
  }

  static async updateEntry(wholesalerId, id, payload) {
    if (!/^[a-f\d]{24}$/i.test(String(id))) throw new BadRequestError('Invalid entry ID.', 'INVALID_ID');
    const entry = calculateEntry(payload);
    if (entry.paidAmount > entry.purchaseAmount) {
      throw new BadRequestError('Paid amount cannot exceed total cost.', 'PAID_AMOUNT_EXCEEDS_TOTAL');
    }
    const updated = await KhataEntry.findOneAndUpdate(
      { _id: id, wholesalerId, transactionType: 'PURCHASE' },
      { $set: entry },
      { new: true, runValidators: true }
    );
    if (!updated) throw new NotFoundError('Khata entry not found.', 'KHATA_ENTRY_NOT_FOUND');
    return updated;
  }

  static async deleteEntry(wholesalerId, id) {
    if (!/^[a-f\d]{24}$/i.test(String(id))) throw new BadRequestError('Invalid entry ID.', 'INVALID_ID');
    const deleted = await KhataEntry.findOneAndDelete({ _id: id, wholesalerId, transactionType: 'PURCHASE' });
    if (!deleted) throw new NotFoundError('Khata entry not found.', 'KHATA_ENTRY_NOT_FOUND');
    return { id: String(deleted._id) };
  }

  static async exportEntries(wholesalerId, filters, format) {
    const [{ items, summary }, settings] = await Promise.all([
      this.getEntries(wholesalerId, filters),
      this.getSettings(wholesalerId),
    ]);
    const range = `${filters.from || 'All dates'} to ${filters.to || 'All dates'}`;
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Vyapar Dwar';
      workbook.created = new Date();
      const sheet = workbook.addWorksheet('Khata Book', { views: [{ state: 'frozen', ySplit: 5 }] });
      sheet.addRow([settings.businessName || 'Vyapar Dwar']);
      sheet.addRow(['Purchase Khata Book']);
      sheet.addRow(['Date range', range]);
      sheet.addRow([]);
      sheet.addRow([
        'Date', 'Product / Item', 'Category', 'Size', 'Colour', 'Brand / Model',
        'Quantity', 'Unit', 'Supplier Name', 'Per Unit Cost', 'Total Cost',
        'Paid Amount', 'Pending Amount', 'Payment Status', 'Notes',
      ]);
      sheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF12304A' } };
      sheet.getRow(2).font = { bold: true, size: 13 };
      sheet.getRow(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12304A' } };
      sheet.addRows(items.map((entry) => [
        entry.date,
        entry.productName,
        entry.category,
        entry.size,
        entry.colour,
        entry.brandModel,
        entry.quantity,
        entry.unit,
        entry.counterpartyName,
        entry.purchaseRate,
        entry.purchaseAmount,
        entry.paidAmount,
        entry.pendingAmount,
        entry.paymentStatus,
        entry.notes,
      ]));
      sheet.columns = [
        { width: 14 }, { width: 24 }, { width: 18 }, { width: 12 }, { width: 14 },
        { width: 20 }, { width: 12 }, { width: 12 }, { width: 24 }, { width: 16 },
        { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 32 },
      ];
      sheet.addRow([]);
      sheet.addRow(['Total purchase', summary.totalPurchase]);
      sheet.addRow(['Total paid', summary.totalPaid]);
      sheet.addRow(['Total pending', summary.totalPending]);
      return {
        buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: 'khata-book.xlsx',
      };
    }

    const lines = [
      settings.businessName || 'Vyapar Dwar',
      'Purchase Khata Book',
      `Date range: ${range}`,
      `Total purchase: Rs ${roundMoney(summary.totalPurchase).toFixed(2)}`,
      `Total paid: Rs ${roundMoney(summary.totalPaid).toFixed(2)}`,
      `Total pending: Rs ${roundMoney(summary.totalPending).toFixed(2)}`,
      '',
      'DATE       PRODUCT / ITEM          QTY  SUPPLIER                 COST       PAID       PENDING   STATUS',
      '------------------------------------------------------------------------------------------------------',
    ];
    for (const entry of items) {
      lines.push(
        `${String(entry.date).slice(0, 10).padEnd(10)} ${String(entry.productName || '-').slice(0, 22).padEnd(22)} ${String(entry.quantity).padStart(4)} ${String(entry.counterpartyName || '-').slice(0, 24).padEnd(24)} ${roundMoney(entry.purchaseAmount).toFixed(2).padStart(9)} ${roundMoney(entry.paidAmount).toFixed(2).padStart(10)} ${roundMoney(entry.pendingAmount).toFixed(2).padStart(10)} ${entry.paymentStatus}`
      );
      const details = [entry.category, entry.size, entry.colour, entry.brandModel, entry.unit, entry.notes].filter(Boolean).join(' | ');
      if (details) lines.push(`           ${details.slice(0, 100)}`);
    }
    return {
      buffer: createPdf(lines),
      contentType: 'application/pdf',
      filename: 'khata-book.pdf',
    };
  }
}

module.exports = { KhataBookService, summarize, calculateEntry };

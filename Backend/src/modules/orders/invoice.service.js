const https = require('https');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const { v2: cloudinary } = require('cloudinary');
const env = require('../../config/env');
const { Order, Payment, User, WholesalerProfile, RetailerProfile } = require('../../models');
const { ORDER_STATUS, ROLES } = require('../../config/constants');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../../utils/errors');

const PAGE_WIDTH = 595.28;
const CONTENT_X = 40;
const CONTENT_WIDTH = PAGE_WIDTH - CONTENT_X * 2;
const NAVY = '#1D2D40';
const MUTED = '#657181';
const GOLD = '#B3945A';
const BORDER = '#E5E8EC';
const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const money = (value) => currency.format(Number(value || 0));
const text = (value) => String(value || '').trim();

function formatAddress(address = {}) {
  if (typeof address === 'string') return text(address);
  return [
    address.street || address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ].map(text).filter(Boolean).join(', ');
}

function invoiceItem(item) {
  const taxableValue = Number(item.taxableValue ?? (
    item.priceIncludesTax
      ? Number(item.subtotal || 0) - Number(item.gstAmount || 0)
      : item.subtotal
  ));
  const cgstAmount = Number(item.cgstAmount ?? (item.igst ? 0 : Number(item.gstAmount || 0) / 2));
  const sgstAmount = Number(item.sgstAmount ?? (item.igst ? 0 : Number(item.gstAmount || 0) - cgstAmount));
  const igstAmount = Number(item.igstAmount ?? (item.igst ? Number(item.gstAmount || 0) : 0));
  return {
    name: text(item.name) || 'Product',
    description: text(item.description),
    sku: text(item.sku) || '-',
    hsnCode: text(item.hsnCode) || '-',
    quantity: Number(item.quantity || 0),
    unit: text(item.unit),
    pricePerUnit: Number(item.pricePerUnit || 0),
    discountAmount: Number(item.discountAmount || 0),
    gstRate: Number(item.gstRate || 0),
    taxableValue,
    cgstAmount,
    sgstAmount,
    igstAmount,
    total: Number(item.total ?? (taxableValue + cgstAmount + sgstAmount + igstAmount)),
  };
}

function getCloudinaryClient() {
  env.assertCloudinaryConfigured();
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

function downloadCloudinaryImage(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['res.cloudinary.com', 'api.cloudinary.com'].includes(parsed.hostname)) {
    throw new Error('Logo URL is not on the approved image host.');
  }
  return new Promise((resolve, reject) => {
    const request = https.get(parsed, (response) => {
      if (response.statusCode !== 200 || !String(response.headers['content-type'] || '').startsWith('image/')) {
        response.resume();
        reject(new Error('Cloud image storage did not return an image.'));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > 5 * 1024 * 1024) {
          request.destroy(new Error('Business logo exceeds the invoice image size limit.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.setTimeout(8000, () => request.destroy(new Error('Timed out retrieving the business logo.')));
    request.on('error', reject);
  });
}

async function loadWholesalerLogo(profile) {
  const logoUrl = text(profile?.businessLogoUrl);
  if (!logoUrl) return null;
  const parsed = new URL(logoUrl);
  if (parsed.pathname.startsWith('/product-images/')) {
    const fileId = parsed.pathname.split('/').filter(Boolean).pop();
    if (!mongoose.Types.ObjectId.isValid(fileId)) throw new Error('Wholesaler logo file reference is invalid.');
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'productImages' });
    const [file] = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    if (!file || !['image/png', 'image/jpeg'].includes(file.contentType)) {
      throw new Error('Wholesaler logo is missing or is not a supported PDF image.');
    }
    return new Promise((resolve, reject) => {
      const chunks = [];
      const stream = bucket.openDownloadStream(file._id);
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
  if (parsed.hostname !== 'res.cloudinary.com' || parsed.protocol !== 'https:') {
    throw new Error('Wholesaler logo URL is not on the approved image host.');
  }
  parsed.pathname = parsed.pathname.replace('/image/upload/', '/image/upload/f_png/');
  return downloadCloudinaryImage(parsed.toString());
}

async function loadRetailerLogo(profile) {
  const asset = profile?.shopPhoto;
  if (!asset?.publicId || !asset?.format) return null;
  const client = getCloudinaryClient();
  const downloadUrl = client.utils.private_download_url(asset.publicId, 'png', {
    resource_type: 'image',
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + 60,
    attachment: false,
  });
  return downloadCloudinaryImage(downloadUrl);
}

function addLogo(document, logo, x, y, size, partyName) {
  if (logo) {
    document.image(logo, x, y, { fit: [size, size], align: 'center', valign: 'center' });
    return;
  }
  document.save()
    .roundedRect(x, y, size, size, 4)
    .lineWidth(0.8)
    .strokeColor(BORDER)
    .stroke()
    .restore();
  document.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
    .text(text(partyName).slice(0, 2).toUpperCase() || 'B', x, y + size / 2 - 5, {
      width: size,
      align: 'center',
      lineBreak: false,
    });
}

function paidAmount(order, payments) {
  const grandTotal = Number(order.grandTotal || 0);
  if (order.isCreditOrder) return Math.min(grandTotal, Number(order.creditPaidAmount || 0));
  if (Number.isSafeInteger(order.directPaidPaise)) return Math.min(grandTotal, order.directPaidPaise / 100);
  if (order.paymentStatus === 'PAID') return grandTotal;
  const reversedPaymentIds = new Set(
    payments.filter((payment) => payment.isReversal).map((payment) => String(payment.reversesPaymentId))
  );
  const paid = payments.reduce((sum, payment) => {
    if (payment.status !== 'PAID' || payment.isReversal || reversedPaymentIds.has(String(payment._id))) return sum;
    if (payment.orderAllocations?.length) {
      const allocation = payment.orderAllocations
        .filter((entry) => String(entry.orderId) === String(order._id))
        .reduce((amount, entry) => amount + Number(entry.amountPaise || 0), 0);
      return sum + allocation / 100;
    }
    return sum + (Number.isSafeInteger(payment.amountPaise)
      ? payment.amountPaise / 100
      : Number(payment.amount || 0));
  }, 0);
  return Math.min(grandTotal, paid);
}

class InvoiceService {
  static async getRetailerLogoUrl(profile) {
    const asset = profile?.shopPhoto;
    if (!asset?.publicId || !asset?.format) return '';
    return getCloudinaryClient().utils.private_download_url(asset.publicId, asset.format, {
      resource_type: 'image',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 300,
      attachment: false,
    });
  }

  static async createRetailerInvoice(orderId, retailerId) {
    return this.createOrderInvoice(orderId, { _id: retailerId, role: ROLES.RETAILER });
  }

  static async createOrderInvoice(orderId, requester) {
    const order = await Order.findById(orderId).lean();
    if (!order || order.isDemo) throw new NotFoundError('Order not found.');
    if (requester.role === ROLES.RETAILER && String(order.retailerId) !== String(requester._id)) {
      throw new ForbiddenError('You can only access invoices for your own orders.');
    }
    if (requester.role === ROLES.WHOLESALER && String(order.wholesalerId) !== String(requester._id)) {
      throw new ForbiddenError('You can only access invoices for orders from your wholesale store.');
    }
    if (![ROLES.RETAILER, ROLES.WHOLESALER].includes(requester.role)) {
      throw new ForbiddenError('You are not allowed to access this invoice.');
    }
    if (order.orderStatus !== ORDER_STATUS.DELIVERED) {
      throw new BadRequestError('Invoices are available after the order is marked as completed.', 'INVOICE_ORDER_NOT_COMPLETED');
    }

    const [sellerProfile, sellerUser, buyerProfile, buyerUser, payments] = await Promise.all([
      WholesalerProfile.findOne({ userId: order.wholesalerId }).lean(),
      User.findById(order.wholesalerId).select('name email phone').lean(),
      RetailerProfile.findOne({ userId: order.retailerId }).lean(),
      User.findById(order.retailerId).select('name email phone').lean(),
      Payment.find({ orderId: order._id })
        .select('amount amountPaise status paymentMethod transactionReference reportedPaymentDate paidAt orderAllocations isReversal reversesPaymentId')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const invoiceNumber = `INV-${text(order.orderNumber)}`;
    const invoiceDate = order.invoiceIssuedAt || order.updatedAt || order.createdAt || new Date();
    const sellerName = sellerProfile?.businessName || sellerUser?.name || 'Wholesaler';
    const buyerName = buyerProfile?.businessName || buyerProfile?.ownerName || buyerUser?.name || 'Retailer';
    const sellerAddress = formatAddress(sellerProfile?.address);
    const bill = order.billingAddress || {};
    const ship = order.shippingAddress || {};
    const buyerAddress = formatAddress({
      street: bill.street || ship.street || buyerProfile?.address?.street,
      addressLine2: bill.addressLine2 || ship.addressLine2,
      city: bill.city || ship.city || buyerProfile?.address?.city,
      state: bill.state || ship.state || buyerProfile?.address?.state,
      pincode: bill.pincode || ship.pincode || buyerProfile?.address?.pincode,
      country: bill.country || ship.country || buyerProfile?.address?.country,
    });
    const items = (order.items || []).map(invoiceItem);
    const [sellerLogo, buyerLogo] = await Promise.all([
      loadWholesalerLogo(sellerProfile),
      loadRetailerLogo(buyerProfile),
    ]);
    const document = new PDFDocument({
      size: 'A4',
      margins: { top: 38, bottom: 42, left: CONTENT_X, right: CONTENT_X },
      info: { Title: invoiceNumber, Author: sellerName },
      bufferPages: true,
    });
    const chunks = [];
    const bufferPromise = new Promise((resolve, reject) => {
      document.on('data', (chunk) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });

    let y = 40;
    const drawPageHeader = (continued = false) => {
      document.rect(CONTENT_X, 28, CONTENT_WIDTH, 3).fill(GOLD);
      addLogo(document, sellerLogo, CONTENT_X, 45, 54, sellerName);
      document.fillColor(NAVY).font('Helvetica-Bold').fontSize(14)
        .text(sellerName, CONTENT_X + 66, 48, { width: 265 });
      document.fillColor(MUTED).font('Helvetica').fontSize(8)
        .text(sellerAddress || 'Business address not provided', CONTENT_X + 66, 67, { width: 275, height: 24 });
      document.text([
        sellerUser?.phone && `Phone: ${sellerUser.phone}`,
        sellerUser?.email,
        sellerProfile?.gstin && `GSTIN: ${sellerProfile.gstin}`,
      ].filter(Boolean).join('  ·  ') || 'Contact details not provided', CONTENT_X + 66, 94, { width: 300, height: 20 });
      document.fillColor(NAVY).font('Helvetica-Bold').fontSize(20)
        .text(continued ? 'TAX INVOICE' : 'TAX INVOICE', 385, 47, { width: 170, align: 'right' });
      document.fillColor(GOLD).fontSize(9).font('Helvetica-Bold')
        .text(invoiceNumber, 385, 75, { width: 170, align: 'right' });
      document.fillColor(MUTED).font('Helvetica').fontSize(8)
        .text(`Invoice date: ${new Date(invoiceDate).toLocaleDateString('en-IN')}`, 385, 92, { width: 170, align: 'right' })
        .text(`Order reference: ${text(order.orderNumber)}`, 385, 105, { width: 170, align: 'right' });
      document.moveTo(CONTENT_X, 124).lineTo(CONTENT_X + CONTENT_WIDTH, 124).strokeColor(BORDER).stroke();
    };

    drawPageHeader();
    y = 140;

    const drawParty = (x, label, name, address, phone, email, gstin, logo) => {
      document.fillColor(GOLD).font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), x, y);
      addLogo(document, logo, x, y + 15, 38, name);
      document.fillColor(NAVY).font('Helvetica-Bold').fontSize(10).text(name, x + 47, y + 16, { width: 205, height: 26 });
      document.fillColor(MUTED).font('Helvetica').fontSize(8)
        .text(address || 'Address not provided', x + 47, y + 34, { width: 205, height: 25 })
        .text([phone && `Phone: ${phone}`, email].filter(Boolean).join('  ·  ') || 'Contact details not provided', x + 47, y + 61, { width: 205, height: 20 })
        .text(`GSTIN: ${text(gstin) || 'Not applicable'}`, x + 47, y + 75, { width: 205 });
    };

    drawParty(CONTENT_X, 'Supplied by', sellerName, sellerAddress, sellerUser?.phone, sellerUser?.email, sellerProfile?.gstin, sellerLogo);
    drawParty(CONTENT_X + 265, 'Billed to', buyerName, buyerAddress, bill.phone || ship.phone || buyerUser?.phone, buyerUser?.email, buyerProfile?.gstin, buyerLogo);
    y += 104;
    document.moveTo(CONTENT_X, y).lineTo(CONTENT_X + CONTENT_WIDTH, y).strokeColor(BORDER).stroke();
    y += 11;
    document.fillColor(MUTED).font('Helvetica').fontSize(8)
      .text(`Invoice date: ${new Date(invoiceDate).toLocaleDateString('en-IN')}    Order date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}    Bilty / LR: ${text(order.shippingDetails?.biltyNumber) || 'Not provided'}`, CONTENT_X, y);
    y += 20;

    const columns = [
      { title: 'S.No.', width: 30, align: 'left' },
      { title: 'PRODUCT / SKU', width: 151, align: 'left' },
      { title: 'QTY', width: 42, align: 'right' },
      { title: 'UNIT PRICE', width: 66, align: 'right' },
      { title: 'TAX', width: 61, align: 'right' },
      { title: 'DISCOUNT', width: 68, align: 'right' },
      { title: 'TOTAL', width: 97, align: 'right' },
    ];
    const drawTableHeader = () => {
      document.rect(CONTENT_X, y, CONTENT_WIDTH, 25).fill(NAVY);
      let x = CONTENT_X + 6;
      columns.forEach((column) => {
        document.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7)
          .text(column.title, x, y + 8, { width: column.width, align: column.align, lineBreak: false });
        x += column.width;
      });
      y += 25;
    };
    drawTableHeader();
    items.forEach((item, index) => {
      if (y + 48 > 730) {
        document.addPage();
        drawPageHeader(true);
        y = 140;
        drawTableHeader();
      }
      const rowHeight = 48;
      if (index % 2 === 0) document.rect(CONTENT_X, y, CONTENT_WIDTH, rowHeight).fill('#F8F8F6');
      document.moveTo(CONTENT_X, y + rowHeight).lineTo(CONTENT_X + CONTENT_WIDTH, y + rowHeight).strokeColor(BORDER).stroke();
      const tax = item.cgstAmount + item.sgstAmount + item.igstAmount;
      const values = [
        String(index + 1),
        `${item.name}\nSKU: ${item.sku}${item.hsnCode !== '-' ? ` · HSN: ${item.hsnCode}` : ''}${item.description ? `\n${item.description}` : ''}`,
        `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`,
        money(item.pricePerUnit),
        money(tax),
        money(item.discountAmount),
        money(item.total),
      ];
      let x = CONTENT_X + 6;
      columns.forEach((column, columnIndex) => {
        document.fillColor(columnIndex === 6 ? NAVY : MUTED)
          .font(columnIndex === 6 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(columnIndex === 1 ? 7 : 7)
          .text(values[columnIndex], x, y + 6, {
            width: column.width,
          height: 36,
            align: column.align,
            ellipsis: true,
          });
        x += column.width;
      });
      y += rowHeight;
    });
    if (!items.length) {
      document.fillColor(MUTED).font('Helvetica').fontSize(9)
        .text('No product details are available for this order.', CONTENT_X + 8, y + 12);
      y += 38;
    }

    const cgstTotal = items.reduce((sum, item) => sum + item.cgstAmount, 0);
    const sgstTotal = items.reduce((sum, item) => sum + item.sgstAmount, 0);
    const igstTotal = items.reduce((sum, item) => sum + item.igstAmount, 0);
    const taxableTotal = items.reduce((sum, item) => sum + item.taxableValue, 0);
    const paid = paidAmount(order, payments);
    const balance = Math.max(0, Number(order.grandTotal || 0) - paid);
    const summaryLines = [
      ['Subtotal', money(order.subtotal)],
      ['Discount', `- ${money(order.discount)}`],
      ['Taxable amount', money(taxableTotal)],
      ['CGST', money(cgstTotal)],
      ['SGST', money(sgstTotal)],
      ['IGST', money(igstTotal)],
      ['Shipping charges', money(order.shipping)],
      ['Grand total', money(order.grandTotal)],
      ['Amount paid', money(paid)],
      ['Outstanding amount', money(balance)],
    ];
    const summaryHeight = summaryLines.length * 15 + 18;
    if (y + summaryHeight > 748) {
      document.addPage();
      drawPageHeader(true);
      y = 143;
    } else {
      y += 14;
    }
    const summaryX = CONTENT_X + 260;
    document.fillColor(NAVY).font('Helvetica-Bold').fontSize(9).text('INVOICE SUMMARY', summaryX, y);
    y += 15;
    summaryLines.forEach(([label, amount]) => {
      const isStrong = ['Grand total', 'Outstanding amount'].includes(label);
      document.fillColor(isStrong ? NAVY : MUTED)
        .font(isStrong ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(isStrong ? 9 : 8)
        .text(label, summaryX, y, { width: 145 })
        .text(amount, summaryX + 145, y, { width: 110, align: 'right' });
      y += isStrong ? 17 : 14;
    });

    const latestPayment = payments[0];
    if (y + 70 > 780) {
      document.addPage();
      drawPageHeader(true);
      y = 145;
    } else {
      y += 9;
    }
    document.moveTo(CONTENT_X, y).lineTo(CONTENT_X + CONTENT_WIDTH, y).strokeColor(BORDER).stroke();
    y += 10;
    document.fillColor(NAVY).font('Helvetica-Bold').fontSize(8).text('PAYMENT INFORMATION', CONTENT_X, y);
    y += 14;
    const paymentDetails = [
      `Method: ${text(latestPayment?.paymentMethod || order.paymentMethod).replace(/_/g, ' ') || 'Not recorded'}`,
      `Status: ${text(latestPayment?.status || order.paymentStatus).replace(/_/g, ' ') || 'Not recorded'}`,
      `Reference: ${text(latestPayment?.transactionReference) || 'Not recorded'}`,
      `Payment date: ${latestPayment?.paidAt || latestPayment?.reportedPaymentDate
        ? new Date(latestPayment.paidAt || latestPayment.reportedPaymentDate).toLocaleDateString('en-IN')
        : 'Not recorded'}`,
    ];
    document.fillColor(MUTED).font('Helvetica').fontSize(8)
      .text(paymentDetails.join('    ·    '), CONTENT_X, y, { width: CONTENT_WIDTH, height: 28 });

    const pages = document.bufferedPageRange();
    for (let pageIndex = 0; pageIndex < pages.count; pageIndex += 1) {
      document.switchToPage(pageIndex);
      document.moveTo(CONTENT_X, 795).lineTo(CONTENT_X + CONTENT_WIDTH, 795).strokeColor(BORDER).stroke();
      document.fillColor(MUTED).font('Helvetica').fontSize(7)
        .text(`Thank you for your business.  ${invoiceNumber}`, CONTENT_X, 803, { width: CONTENT_WIDTH, align: 'center' });
    }
    document.end();

    return {
      buffer: await bufferPromise,
      filename: `${invoiceNumber}.pdf`,
    };
  }
}

module.exports = InvoiceService;

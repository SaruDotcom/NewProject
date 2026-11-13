const PDFDocument = require('pdfkit');
const { Order, User, WholesalerProfile, RetailerProfile } = require('../../models');
const { ORDER_STATUS } = require('../../config/constants');
const { BadRequestError, NotFoundError } = require('../../utils/errors');

const money = (value) => `INR ${Number(value || 0).toFixed(2)}`;
const text = (value) => String(value || '').trim();

function formatAddress(address = {}) {
  return [
    address.street,
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
    hsnCode: text(item.hsnCode) || '-',
    quantity: Number(item.quantity || 0),
    taxableValue,
    cgstAmount,
    sgstAmount,
    igstAmount,
    total: Number(item.total ?? (taxableValue + cgstAmount + sgstAmount + igstAmount)),
  };
}

class InvoiceService {
  static async createRetailerInvoice(orderId, retailerId) {
    const order = await Order.findOne({ _id: orderId, retailerId }).lean();
    if (!order) throw new NotFoundError('Order not found.');
    if (order.orderStatus !== ORDER_STATUS.DELIVERED) {
      throw new BadRequestError('Invoices are available after the order is marked as completed.', 'INVOICE_ORDER_NOT_COMPLETED');
    }

    const [sellerProfile, sellerUser, retailerProfile, retailerUser] = await Promise.all([
      WholesalerProfile.findOne({ userId: order.wholesalerId }).lean(),
      User.findById(order.wholesalerId).select('name email phone').lean(),
      RetailerProfile.findOne({ userId: order.retailerId }).lean(),
      User.findById(order.retailerId).select('name email phone').lean(),
    ]);

    const invoiceNumber = `INV-${order.orderNumber}`;
    const invoiceDate = order.invoiceIssuedAt || order.updatedAt || order.createdAt || new Date();
    const sellerName = sellerProfile?.businessName || sellerUser?.name || 'Seller';
    const customerName = retailerProfile?.businessName || retailerUser?.name || 'Customer';
    const bill = order.billingAddress || {};
    const ship = order.shippingAddress || {};
    const customerAddress = formatAddress({
      street: bill.street || ship.street || retailerProfile?.address?.street,
      addressLine2: bill.addressLine2 || ship.addressLine2,
      city: bill.city || ship.city || retailerProfile?.address?.city,
      state: bill.state || ship.state || retailerProfile?.address?.state,
      pincode: bill.pincode || ship.pincode || retailerProfile?.address?.pincode,
      country: bill.country || ship.country || retailerProfile?.address?.country,
    });
    const items = (order.items || []).map(invoiceItem);
    const document = new PDFDocument({ size: 'A4', margin: 40, info: { Title: invoiceNumber, Author: sellerName } });
    const chunks = [];
    const bufferPromise = new Promise((resolve, reject) => {
      document.on('data', (chunk) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });

    document.fillColor('#12304A').fontSize(21).font('Helvetica-Bold').text('TAX INVOICE', 40, 38);
    document.fillColor('#4B5563').fontSize(9).font('Helvetica').text(invoiceNumber, 40, 66);
    document.text(`Invoice date: ${new Date(invoiceDate).toLocaleDateString('en-IN')}`, 350, 42, { width: 220, align: 'right' });
    document.text(`Order number: ${text(order.orderNumber)}`, 350, 56, { width: 220, align: 'right' });
    document.moveTo(40, 86).lineTo(572, 86).strokeColor('#D7DEE5').stroke();

    const sellerAddress = formatAddress(sellerProfile?.address);
    document.fillColor('#12304A').font('Helvetica-Bold').fontSize(10).text('SELLER', 40, 100);
    document.fillColor('#1F2937').font('Helvetica-Bold').fontSize(11).text(sellerName, 40, 117, { width: 250 });
    document.font('Helvetica').fontSize(9).fillColor('#4B5563')
      .text(sellerAddress || '-', 40, 133, { width: 245 })
      .text(`GSTIN: ${text(sellerProfile?.gstin) || 'Not provided'}`, 40, 165, { width: 245 })
      .text(`Contact: ${text(sellerUser?.phone) || text(sellerUser?.email) || '-'}`, 40, 179, { width: 245 });

    document.fillColor('#12304A').font('Helvetica-Bold').fontSize(10).text('BILL TO', 310, 100);
    document.fillColor('#1F2937').font('Helvetica-Bold').fontSize(11).text(customerName, 310, 117, { width: 260 });
    document.font('Helvetica').fontSize(9).fillColor('#4B5563')
      .text(customerAddress || '-', 310, 133, { width: 260 })
      .text(`GSTIN: ${text(retailerProfile?.gstin) || 'Not provided'}`, 310, 165, { width: 260 })
      .text(`Contact: ${text(order.billingAddress?.phone || order.shippingAddress?.phone || retailerUser?.phone) || text(retailerUser?.email) || '-'}`, 310, 179, { width: 260 });

    let y = 214;
    const columns = [
      { title: 'Product', width: 126, align: 'left' },
      { title: 'HSN', width: 42, align: 'left' },
      { title: 'Qty', width: 32, align: 'right' },
      { title: 'Taxable', width: 65, align: 'right' },
      { title: 'CGST', width: 48, align: 'right' },
      { title: 'SGST', width: 48, align: 'right' },
      { title: 'IGST', width: 48, align: 'right' },
      { title: 'Total', width: 78, align: 'right' },
    ];
    const drawTableHeader = () => {
      document.rect(40, y, 532, 25).fill('#12304A');
      let x = 46;
      columns.forEach((column) => {
        document.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5)
          .text(column.title, x, y + 8, { width: column.width, align: column.align, lineBreak: false });
        x += column.width;
      });
      y += 25;
    };
    drawTableHeader();
    items.forEach((item, index) => {
      if (y > 710) {
        document.addPage();
        y = 40;
        drawTableHeader();
      }
      const rowHeight = 34;
      if (index % 2 === 0) document.rect(40, y, 532, rowHeight).fill('#F5F8FA');
      const values = [
        item.name,
        item.hsnCode,
        String(item.quantity),
        Number(item.taxableValue).toFixed(2),
        Number(item.cgstAmount).toFixed(2),
        Number(item.sgstAmount).toFixed(2),
        Number(item.igstAmount).toFixed(2),
        Number(item.total).toFixed(2),
      ];
      let x = 46;
      columns.forEach((column, columnIndex) => {
        document.fillColor('#1F2937').font('Helvetica').fontSize(7.5)
          .text(values[columnIndex], x, y + 8, { width: column.width, height: 22, align: column.align, ellipsis: true });
        x += column.width;
      });
      y += rowHeight;
    });

    if (y > 650) {
      document.addPage();
      y = 40;
    } else {
      y += 14;
    }
    const totals = [
      ['Subtotal', money(order.subtotal)],
      ['Discount', `- ${money(order.discount)}`],
      ['GST', money(order.tax)],
      ['Shipping', money(order.shipping)],
      ['Grand Total', money(order.grandTotal)],
    ];
    totals.forEach(([label, amount]) => {
      const isTotal = label === 'Grand Total';
      document.fillColor(isTotal ? '#12304A' : '#4B5563')
        .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(isTotal ? 11 : 9)
        .text(label, 360, y, { width: 95, align: 'right' })
        .text(amount, 460, y, { width: 112, align: 'right' });
      y += isTotal ? 21 : 16;
    });

    document.moveTo(40, 760).lineTo(572, 760).strokeColor('#D7DEE5').stroke();
    document.fillColor('#6B7280').font('Helvetica').fontSize(8)
      .text(`Thank you for your business. Invoice for order ${text(order.orderNumber)}.`, 40, 770, { width: 532, align: 'center' });
    document.end();

    return {
      buffer: await bufferPromise,
      filename: `${invoiceNumber}.pdf`,
    };
  }
}

module.exports = InvoiceService;

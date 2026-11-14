const mongoose = require('mongoose');
const {
  Inventory,
  InventoryTransaction,
  Product,
  PurchaseBill,
  PurchasePayment,
  PurchaseReturn,
  Supplier,
  SupplierLedgerEntry,
} = require('../../models');
const { INVENTORY_TRANSACTION_TYPE } = require('../../config/constants');
const { AppError, BadRequestError, ConflictError, NotFoundError } = require('../../utils/errors');

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const roundQuantity = (value) => Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
const PAYMENT_MODES = Object.freeze(['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER']);

function paymentStatus(total, paid, returned = 0, refunded = 0) {
  const outstanding = Math.max(0, roundMoney(total - paid - returned + refunded));
  if (outstanding === 0) return 'PAID';
  return paid > 0 ? 'PARTIAL' : 'UDHAAR';
}

function unitKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const aliases = {
    kg: 'KG',
    kgs: 'KG',
    kilogram: 'KG',
    kilograms: 'KG',
    box: 'BOX',
    boxes: 'BOX',
    carton: 'CARTON',
    cartons: 'CARTON',
    piece: 'PIECES',
    pieces: 'PIECES',
    pcs: 'PIECES',
    pc: 'PIECES',
    meter: 'METER',
    meters: 'METER',
    metre: 'METER',
    metres: 'METER',
  };
  return aliases[normalized] || '';
}

function calculateTotals(payload, productsById) {
  const seenProducts = new Set();
  const items = payload.items.map((item) => {
    const key = String(item.productId);
    if (seenProducts.has(key)) {
      throw new BadRequestError('Add each product once per bill and combine its quantity.', 'DUPLICATE_PURCHASE_ITEM');
    }
    seenProducts.add(key);

    const product = productsById.get(key);
    if (!product) throw new NotFoundError('A selected product was not found in your inventory.', 'PURCHASE_PRODUCT_NOT_FOUND');
    if (product.status === 'BLOCKED') {
      throw new ConflictError('A blocked product cannot be added to a purchase bill.', 'PURCHASE_PRODUCT_BLOCKED');
    }
    const productUnit = unitKey(product.unit);
    if (productUnit && productUnit !== item.unit) {
      throw new BadRequestError(
        `${product.name} is recorded in ${product.unit}; purchase it using the same unit.`,
        'PURCHASE_UNIT_MISMATCH'
      );
    }

    const quantity = roundQuantity(item.quantity);
    const purchaseRate = roundMoney(item.purchaseRate);
    const taxableAmount = roundMoney(quantity * purchaseRate);
    const gstPercent = Number(item.gstPercent || 0);
    const gstAmount = roundMoney(taxableAmount * gstPercent / 100);
    return {
      productId: product._id,
      productName: product.name,
      quantity,
      unit: item.unit,
      purchaseRate,
      taxableAmount,
      gstPercent,
      gstAmount,
      itemTotal: roundMoney(taxableAmount + gstAmount),
      stockAppliedQuantity: payload.stockUpdateEnabled ? quantity : 0,
      returnedQuantity: 0,
    };
  });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.taxableAmount, 0));
  const gstTotal = roundMoney(items.reduce((sum, item) => sum + item.gstAmount, 0));
  const transportCharges = roundMoney(payload.transportCharges || 0);
  const loadingCharges = roundMoney(payload.loadingCharges || 0);
  const preDiscountTotal = roundMoney(subtotal + gstTotal + transportCharges + loadingCharges);
  const discountType = payload.discountType || 'AMOUNT';
  const discountValue = roundMoney(payload.discountValue || 0);
  const discountAmount = discountType === 'PERCENT'
    ? roundMoney(subtotal * discountValue / 100)
    : discountValue;

  if (discountAmount > preDiscountTotal) {
    throw new BadRequestError('Discount cannot exceed the total bill amount.', 'DISCOUNT_EXCEEDS_BILL');
  }

  const totalAmount = roundMoney(preDiscountTotal - discountAmount);
  const paidAmount = roundMoney(payload.paymentAmount || 0);
  if (paidAmount > totalAmount) {
    throw new BadRequestError('Payment amount cannot exceed the total bill amount.', 'PAYMENT_EXCEEDS_BILL');
  }

  return {
    items,
    subtotal,
    gstTotal,
    transportCharges,
    loadingCharges,
    discountType,
    discountValue,
    discountAmount,
    totalAmount,
    paidAmount,
    outstandingAmount: Math.max(0, roundMoney(totalAmount - paidAmount)),
    paymentStatus: paymentStatus(totalAmount, paidAmount),
    paymentMode: paidAmount > 0 ? payload.paymentMode : '',
    billDate: payload.billDate,
    dueDate: payload.dueDate || null,
    notes: payload.notes || '',
    stockUpdateEnabled: Boolean(payload.stockUpdateEnabled),
  };
}

function billSnapshot(bill) {
  return {
    supplierId: String(bill.supplierId),
    invoiceNumber: bill.invoiceNumber,
    billDate: bill.billDate,
    items: bill.items.map((item) => ({
      productId: String(item.productId),
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      purchaseRate: item.purchaseRate,
      gstPercent: item.gstPercent,
      stockAppliedQuantity: item.stockAppliedQuantity,
      returnedQuantity: item.returnedQuantity,
      stockReturnedQuantity: item.stockReturnedQuantity,
    })),
    subtotal: bill.subtotal,
    gstTotal: bill.gstTotal,
    transportCharges: bill.transportCharges,
    loadingCharges: bill.loadingCharges,
    discountType: bill.discountType,
    discountValue: bill.discountValue,
    discountAmount: bill.discountAmount,
    totalAmount: bill.totalAmount,
    paidAmount: bill.paidAmount,
    outstandingAmount: bill.outstandingAmount,
    paymentStatus: bill.paymentStatus,
    returnAmount: bill.returnAmount,
    refundedAmount: bill.refundedAmount,
    paymentMode: bill.paymentMode,
    dueDate: bill.dueDate,
    stockUpdateEnabled: bill.stockUpdateEnabled,
    status: bill.status,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function inTransaction(work) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } catch (error) {
    const transactionUnsupported = error?.code === 20 ||
      (error?.codeName === 'IllegalOperation' && /transaction numbers are only allowed/i.test(error.message || ''));
    if (transactionUnsupported) {
      throw new AppError(
        'Purchase management requires MongoDB replica-set transactions. Configure the database with transaction support and retry.',
        503,
        'MONGODB_TRANSACTIONS_REQUIRED'
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

async function findSupplier(wholesalerId, supplierId, session, { active = true } = {}) {
  const query = { _id: supplierId, wholesalerId };
  if (active) query.isActive = true;
  const supplier = await Supplier.findOne(query).session(session);
  if (!supplier) throw new NotFoundError('Supplier not found for this wholesaler.', 'SUPPLIER_NOT_FOUND');
  return supplier;
}

async function findProducts(wholesalerId, productIds, session) {
  const ids = [...new Set(productIds.map(String))];
  const products = await Product.find({
    _id: { $in: ids },
    wholesalerId,
    isDeleted: { $ne: true },
  }).session(session);
  const productsById = new Map(products.map((product) => [String(product._id), product]));
  if (productsById.size !== ids.length) {
    throw new NotFoundError('A selected product was not found in your inventory.', 'PURCHASE_PRODUCT_NOT_FOUND');
  }
  return productsById;
}

async function appendLedger({
  wholesalerId,
  supplier,
  type,
  amount,
  effectiveDate,
  referenceType = '',
  referenceId = null,
  transactionKey,
  notes = '',
  actorId,
  session,
}) {
  const value = roundMoney(amount);
  if (value === 0) return null;
  supplier.currentBalance = roundMoney(supplier.currentBalance + value);
  await supplier.save({ session });
  const [entry] = await SupplierLedgerEntry.create([{
    wholesalerId,
    supplierId: supplier._id,
    type,
    amount: value,
    balanceAfter: supplier.currentBalance,
    effectiveDate,
    referenceType,
    referenceId,
    transactionKey,
    notes,
    actorId,
  }], { session });
  return entry;
}

async function applyStockDelta({
  wholesalerId,
  product,
  delta,
  actorId,
  referenceType,
  referenceId,
  notes,
  session,
  decreaseType = INVENTORY_TRANSACTION_TYPE.ADJUSTMENT,
}) {
  const quantity = roundQuantity(delta);
  if (quantity === 0) return;
  let inventory = await Inventory.findOne({ productId: product._id, wholesalerId }).session(session);
  if (!inventory) {
    const existingStock = Number(product.stockQuantity || product.stock || 0);
    [inventory] = await Inventory.create([{
      productId: product._id,
      wholesalerId,
      available: existingStock,
      reserved: 0,
      sold: 0,
    }], { session });
  }

  const previousAvailable = roundQuantity(inventory.available || 0);
  const newAvailable = roundQuantity(previousAvailable + quantity);
  if (newAvailable < 0) {
    throw new ConflictError(
      `${product.name} does not have enough available stock for this change.`,
      'INSUFFICIENT_AVAILABLE_STOCK'
    );
  }

  inventory.available = newAvailable;
  await inventory.save({ session });
  product.stock = newAvailable;
  product.stockQuantity = newAvailable;
  await product.save({ session });
  await InventoryTransaction.create([{
    inventoryId: inventory._id,
    productId: product._id,
    wholesalerId,
    type: quantity > 0 ? INVENTORY_TRANSACTION_TYPE.RECEIVE : decreaseType,
    quantity: Math.abs(quantity),
    previousAvailable,
    newAvailable,
    referenceType,
    referenceId: String(referenceId),
    performedBy: actorId,
    notes,
  }], { session });
}

function stockQuantityMap(items, { useApplied = false, enabled = false } = {}) {
  const totals = new Map();
  items.forEach((item) => {
    const productId = String(item.productId);
    const quantity = useApplied
      ? Number(item.stockAppliedQuantity || 0)
      : enabled
        ? Number(item.quantity || 0)
        : 0;
    totals.set(productId, roundQuantity((totals.get(productId) || 0) + quantity));
  });
  return totals;
}

async function applySellingPriceUpdates(productsById, updates, billProductIds, session) {
  const applied = new Set();
  for (const update of updates || []) {
    const id = String(update.productId);
    if (!billProductIds.has(id)) {
      throw new BadRequestError('Selling price can only be updated for a product on this bill.', 'INVALID_SELLING_PRICE_PRODUCT');
    }
    if (applied.has(id)) throw new BadRequestError('A product selling price was submitted more than once.', 'DUPLICATE_SELLING_PRICE_UPDATE');
    applied.add(id);
    const product = productsById.get(id);
    if (!product) throw new NotFoundError('Product for the selling price update was not found.', 'PURCHASE_PRODUCT_NOT_FOUND');
    const price = roundMoney(update.retailerPrice);
    product.wholesalePrice = price;
    product.sellingPrice = price;
    product.retailerPrice = price;
    product.basePrice = price;
    await product.save({ session });
  }
}

function paymentDocument({
  wholesalerId,
  supplierId,
  billId = null,
  amount,
  direction = 'OUTGOING',
  paymentDate,
  paymentMode,
  notes = '',
  source,
  allocations = [],
  idempotencyKey,
  createdBy,
}) {
  return {
    wholesalerId,
    supplierId,
    billId,
    amount: roundMoney(amount),
    direction,
    paymentDate,
    paymentMode,
    notes,
    source,
    allocations,
    idempotencyKey,
    createdBy,
  };
}

class PurchasesService {
  static async getDashboardSummary(wholesalerId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [bills, payments, returns, suppliers] = await Promise.all([
      PurchaseBill.find({ wholesalerId, status: 'ACTIVE' }).select('totalAmount outstandingAmount dueDate').lean(),
      PurchasePayment.find({ wholesalerId, status: 'POSTED' }).select('amount direction').lean(),
      PurchaseReturn.find({ wholesalerId, status: 'ACTIVE' }).select('returnAmount').lean(),
      Supplier.find({ wholesalerId, isActive: true }).select('currentBalance').lean(),
    ]);

    return {
      totalPurchases: roundMoney(bills.reduce((sum, bill) => sum + bill.totalAmount, 0)),
      totalPaid: roundMoney(payments.reduce((sum, payment) => (
        sum + payment.amount * (payment.direction === 'REFUND_RECEIVED' ? -1 : 1)
      ), 0)),
      totalOutstanding: roundMoney(suppliers.reduce((sum, supplier) => sum + Math.max(0, supplier.currentBalance), 0)),
      overduePayments: roundMoney(bills.reduce((sum, bill) => (
        bill.dueDate && bill.dueDate < today ? sum + bill.outstandingAmount : sum
      ), 0)),
      totalReturns: roundMoney(returns.reduce((sum, entry) => sum + entry.returnAmount, 0)),
    };
  }

  static async listSuppliers(wholesalerId, { includeInactive = false, search = '' } = {}) {
    const query = { wholesalerId };
    if (!includeInactive) query.isActive = true;
    if (search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [{ name: regex }, { mobile: regex }, { gstin: regex }];
    }
    const suppliers = await Supplier.find(query).sort({ name: 1 }).lean();
    if (!suppliers.length) return [];

    const supplierIds = suppliers.map((supplier) => supplier._id);
    const [bills, payments, returns] = await Promise.all([
      PurchaseBill.find({ wholesalerId, supplierId: { $in: supplierIds }, status: 'ACTIVE' })
        .select('supplierId totalAmount outstandingAmount dueDate')
        .lean(),
      PurchasePayment.find({ wholesalerId, supplierId: { $in: supplierIds }, status: 'POSTED' })
        .select('supplierId amount direction')
        .lean(),
      PurchaseReturn.find({ wholesalerId, supplierId: { $in: supplierIds }, status: 'ACTIVE' })
        .select('supplierId returnAmount')
        .lean(),
    ]);

    const totals = new Map(supplierIds.map((id) => [String(id), {
      totalPurchases: 0,
      totalPayments: 0,
      purchaseReturns: 0,
      nextDueDate: null,
    }]));
    bills.forEach((bill) => {
      const summary = totals.get(String(bill.supplierId));
      summary.totalPurchases += bill.totalAmount;
      if (bill.outstandingAmount > 0 && bill.dueDate && (!summary.nextDueDate || bill.dueDate < summary.nextDueDate)) {
        summary.nextDueDate = bill.dueDate;
      }
    });
    payments.forEach((payment) => {
      const summary = totals.get(String(payment.supplierId));
      summary.totalPayments += payment.amount * (payment.direction === 'REFUND_RECEIVED' ? -1 : 1);
    });
    returns.forEach((entry) => {
      totals.get(String(entry.supplierId)).purchaseReturns += entry.returnAmount;
    });

    return suppliers.map((supplier) => ({
      ...supplier,
      ...(totals.get(String(supplier._id))),
    }));
  }

  static async createSupplier(wholesalerId, actorId, payload) {
    return inTransaction(async (session) => {
      const [supplier] = await Supplier.create([{
        ...payload,
        wholesalerId,
        openingBalance: roundMoney(payload.openingBalance || 0),
        currentBalance: 0,
        createdBy: actorId,
      }], { session });
      await appendLedger({
        wholesalerId,
        supplier,
        type: 'OPENING_BALANCE',
        amount: supplier.openingBalance,
        effectiveDate: new Date(),
        referenceType: 'SUPPLIER',
        referenceId: supplier._id,
        transactionKey: `supplier:${supplier._id}:opening`,
        notes: 'Supplier opening balance',
        actorId,
        session,
      });
      return supplier;
    });
  }

  static async updateSupplier(wholesalerId, supplierId, payload) {
    const updated = await Supplier.findOneAndUpdate(
      { _id: supplierId, wholesalerId, isActive: true },
      { $set: payload },
      { new: true, runValidators: true }
    );
    if (!updated) throw new NotFoundError('Supplier not found for this wholesaler.', 'SUPPLIER_NOT_FOUND');
    return updated;
  }

  static async deactivateSupplier(wholesalerId, supplierId) {
    const supplier = await Supplier.findOne({ _id: supplierId, wholesalerId, isActive: true });
    if (!supplier) throw new NotFoundError('Supplier not found for this wholesaler.', 'SUPPLIER_NOT_FOUND');
    if (Math.abs(supplier.currentBalance) >= 0.01) {
      throw new ConflictError('Settle the supplier balance before deactivating this supplier.', 'SUPPLIER_HAS_BALANCE');
    }
    supplier.isActive = false;
    await supplier.save();
    return { id: String(supplier._id), isActive: false };
  }

  static async checkDuplicate(wholesalerId, { supplierId, invoiceNumber, excludeId }) {
    const query = {
      wholesalerId,
      supplierId,
      invoiceNumber: new RegExp(`^${escapeRegex(invoiceNumber.trim())}$`, 'i'),
    };
    if (excludeId) query._id = { $ne: excludeId };
    const bill = await PurchaseBill.findOne(query).select('_id invoiceNumber billDate totalAmount status').lean();
    return { duplicate: Boolean(bill), bill };
  }

  static async listPurchases(wholesalerId, filters) {
    const query = { wholesalerId };
    if (filters.status !== 'ALL') query.status = filters.status || 'ACTIVE';
    if (filters.supplierId) query.supplierId = filters.supplierId;
    if (filters.billType) query.billType = filters.billType;
    if (filters.from || filters.to) {
      query.billDate = {};
      if (filters.from) query.billDate.$gte = filters.from;
      if (filters.to) {
        const to = new Date(filters.to);
        to.setHours(23, 59, 59, 999);
        query.billDate.$lte = to;
      }
    }
    if (filters.search) {
      const regex = new RegExp(escapeRegex(filters.search.trim()), 'i');
      const matchingSuppliers = await Supplier.find({
        wholesalerId,
        $or: [{ name: regex }, { mobile: regex }],
      }).distinct('_id');
      query.$or = [
        { invoiceNumber: regex },
        { notes: regex },
        { supplierId: { $in: matchingSuppliers } },
      ];
    }
    const page = filters.page || 1;
    const limit = filters.limit || 25;
    const [items, total] = await Promise.all([
      PurchaseBill.find(query)
        .populate('supplierId', 'name mobile')
        .sort({ billDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PurchaseBill.countDocuments(query),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getPurchase(wholesalerId, billId) {
    const bill = await PurchaseBill.findOne({ _id: billId, wholesalerId })
      .populate('supplierId', 'name mobile address gstin')
      .lean();
    if (!bill) throw new NotFoundError('Purchase bill not found.', 'PURCHASE_BILL_NOT_FOUND');
    return bill;
  }

  static async getSupplier(wholesalerId, supplierId) {
    const supplier = (await this.listSuppliers(wholesalerId, { includeInactive: true }))
      .find((item) => String(item._id) === String(supplierId));
    if (!supplier) throw new NotFoundError('Supplier not found for this wholesaler.', 'SUPPLIER_NOT_FOUND');
    return supplier;
  }

  static async getSupplierLedger(wholesalerId, supplierId, filters) {
    await this.getSupplier(wholesalerId, supplierId);
    const query = { wholesalerId, supplierId };
    if (filters.from || filters.to) {
      query.effectiveDate = {};
      if (filters.from) query.effectiveDate.$gte = filters.from;
      if (filters.to) {
        const to = new Date(filters.to);
        to.setHours(23, 59, 59, 999);
        query.effectiveDate.$lte = to;
      }
    }
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const [items, total, supplier] = await Promise.all([
      SupplierLedgerEntry.find(query)
        .populate('actorId', 'name email')
        .sort({ createdAt: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SupplierLedgerEntry.countDocuments(query),
      Supplier.findOne({ _id: supplierId, wholesalerId }).select('openingBalance currentBalance name mobile').lean(),
    ]);
    return {
      supplier,
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async listSupplierPayments(wholesalerId, supplierId) {
    await this.getSupplier(wholesalerId, supplierId);
    return PurchasePayment.find({ wholesalerId, supplierId })
      .populate('billId', 'invoiceNumber billDate')
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean();
  }

  static async createPurchase(wholesalerId, actorId, payload) {
    let result;
    try {
      result = await inTransaction(async (session) => {
        const existingByKey = await PurchaseBill.findOne({
          wholesalerId,
          idempotencyKey: payload.idempotencyKey,
        }).session(session);
        if (existingByKey) return existingByKey;

        const supplier = await findSupplier(wholesalerId, payload.supplierId, session);
        const billType = payload.billType || 'FULL';
        const invoiceNumber = payload.invoiceNumber?.trim().toUpperCase() ||
          `QUICK-${String(payload.idempotencyKey).replace(/[^a-zA-Z0-9]/g, '').slice(-24).toUpperCase()}`;
        const duplicate = await PurchaseBill.findOne({
          wholesalerId,
          supplierId: supplier._id,
          invoiceNumber: new RegExp(`^${escapeRegex(invoiceNumber)}$`, 'i'),
        }).session(session);
        if (duplicate) {
          throw new ConflictError(
            'This bill number already exists for this supplier. Review the existing bill before continuing.',
            'DUPLICATE_PURCHASE_BILL'
          );
        }

        const productsById = await findProducts(
          wholesalerId,
          payload.items.map((item) => item.productId),
          session
        );
        const calculated = calculateTotals(payload, productsById);
        const billId = new mongoose.Types.ObjectId();
        const bill = new PurchaseBill({
          ...calculated,
          _id: billId,
          wholesalerId,
          supplierId: supplier._id,
          billType,
          invoiceNumber,
          idempotencyKey: payload.idempotencyKey,
          createdBy: actorId,
          auditHistory: [{ action: 'CREATED', actorId, at: new Date(), after: null }],
        });
        bill.auditHistory[0].after = billSnapshot(bill);
        await bill.save({ session });

        const stockTotals = stockQuantityMap(bill.items, { enabled: calculated.stockUpdateEnabled });
        for (const [productId, quantity] of stockTotals) {
          if (quantity > 0) {
            await applyStockDelta({
              wholesalerId,
              product: productsById.get(productId),
              delta: quantity,
              actorId,
              referenceType: 'RESTOCK',
              referenceId: bill._id,
              notes: `Stock received from purchase bill ${bill.invoiceNumber}`,
              session,
            });
          }
        }

        for (const item of bill.items) {
          const product = productsById.get(String(item.productId));
          product.costPrice = item.purchaseRate;
          await product.save({ session });
        }
        await applySellingPriceUpdates(
          productsById,
          payload.sellingPriceUpdates,
          new Set(bill.items.map((item) => String(item.productId))),
          session
        );

        await appendLedger({
          wholesalerId,
          supplier,
          type: 'PURCHASE',
          amount: bill.totalAmount,
          effectiveDate: bill.billDate,
          referenceType: 'PURCHASE_BILL',
          referenceId: bill._id,
          transactionKey: `purchase:${bill._id}:total`,
          notes: `Purchase bill ${bill.invoiceNumber}`,
          actorId,
          session,
        });

        if (bill.paidAmount > 0) {
          const [payment] = await PurchasePayment.create([paymentDocument({
            wholesalerId,
            supplierId: supplier._id,
            billId: bill._id,
            amount: bill.paidAmount,
            paymentDate: payload.paymentDate || bill.billDate,
            paymentMode: bill.paymentMode,
            notes: 'Payment recorded with purchase bill',
            source: 'BILL',
            allocations: [{ billId: bill._id, amount: bill.paidAmount }],
            idempotencyKey: `bill:${bill._id}:initial-payment`,
            createdBy: actorId,
          })], { session });
          await appendLedger({
            wholesalerId,
            supplier,
            type: 'PAYMENT',
            amount: -payment.amount,
            effectiveDate: payment.paymentDate,
            referenceType: 'PURCHASE_PAYMENT',
            referenceId: payment._id,
            transactionKey: `payment:${payment._id}`,
            notes: payment.notes,
            actorId,
            session,
          });
        }

        return bill;
      });
    } catch (error) {
      if (error?.code === 11000) {
        const existingByKey = await PurchaseBill.findOne({
          wholesalerId,
          idempotencyKey: payload.idempotencyKey,
        }).select('_id').lean();
        if (existingByKey) return this.getPurchase(wholesalerId, existingByKey._id);
        const invoiceNumber = payload.invoiceNumber?.trim().toUpperCase() ||
          `QUICK-${String(payload.idempotencyKey).replace(/[^a-zA-Z0-9]/g, '').slice(-24).toUpperCase()}`;
        const existing = await PurchaseBill.findOne({
          wholesalerId,
          supplierId: payload.supplierId,
          invoiceNumber: new RegExp(`^${escapeRegex(invoiceNumber)}$`, 'i'),
        }).select('_id').lean();
        if (existing) {
          throw new ConflictError(
            'This bill number already exists for this supplier. Review the existing bill before continuing.',
            'DUPLICATE_PURCHASE_BILL'
          );
        }
      }
      throw error;
    }
    return this.getPurchase(wholesalerId, result._id);
  }

  static async updatePurchase(wholesalerId, actorId, billId, payload) {
    await inTransaction(async (session) => {
      const bill = await PurchaseBill.findOne({ _id: billId, wholesalerId }).session(session);
      if (!bill) throw new NotFoundError('Purchase bill not found.', 'PURCHASE_BILL_NOT_FOUND');
      if (bill.status !== 'ACTIVE') throw new ConflictError('A cancelled bill cannot be edited.', 'PURCHASE_BILL_CANCELLED');
      if (payload.expectedRevision !== bill.revision) {
        throw new ConflictError('This bill changed since it was opened. Reload it before saving.', 'PURCHASE_BILL_STALE');
      }
      if (payload.billType !== bill.billType ||
        String(payload.supplierId) !== String(bill.supplierId) ||
        (bill.billType === 'FULL' &&
          payload.invoiceNumber.trim().toUpperCase() !== bill.invoiceNumber.toUpperCase())) {
        throw new BadRequestError('Supplier and invoice number cannot be changed after a bill is saved.', 'PURCHASE_IDENTITY_IMMUTABLE');
      }
      const activeReturns = await PurchaseReturn.exists({
        wholesalerId,
        purchaseBillId: bill._id,
        status: 'ACTIVE',
      }).session(session);
      if (activeReturns) {
        throw new ConflictError('A bill with an active purchase return cannot be edited.', 'PURCHASE_HAS_RETURNS');
      }

      const before = billSnapshot(bill);
      const productsById = await findProducts(
        wholesalerId,
        [...bill.items.map((item) => item.productId), ...payload.items.map((item) => item.productId)],
        session
      );
      const calculated = calculateTotals(payload, productsById);
      const newPaidAmount = roundMoney(payload.paymentAmount);
      if (newPaidAmount > calculated.totalAmount) {
        throw new BadRequestError('Payment amount cannot exceed the updated bill total.', 'PAYMENT_EXCEEDS_BILL');
      }

      const oldStock = stockQuantityMap(bill.items, { useApplied: true });
      const nextStock = stockQuantityMap(calculated.items, { enabled: calculated.stockUpdateEnabled });
      const productIds = new Set([...oldStock.keys(), ...nextStock.keys()]);
      for (const productId of productIds) {
        const delta = roundQuantity((nextStock.get(productId) || 0) - (oldStock.get(productId) || 0));
        if (delta !== 0) {
          await applyStockDelta({
            wholesalerId,
            product: productsById.get(productId),
            delta,
            actorId,
            referenceType: 'RESTOCK',
            referenceId: bill._id,
            notes: `Stock quantity adjusted by editing purchase bill ${bill.invoiceNumber}`,
            session,
          });
        }
      }

      const newRevision = bill.revision + 1;
      const purchaseDifference = roundMoney(calculated.totalAmount - bill.totalAmount);
      const paidDifference = roundMoney(newPaidAmount - bill.paidAmount);
      if (purchaseDifference !== 0) {
        const supplier = await findSupplier(wholesalerId, bill.supplierId, session, { active: false });
        await appendLedger({
          wholesalerId,
          supplier,
          type: 'PURCHASE_ADJUSTMENT',
          amount: purchaseDifference,
          effectiveDate: calculated.billDate,
          referenceType: 'PURCHASE_BILL',
          referenceId: bill._id,
          transactionKey: `purchase:${bill._id}:revision:${newRevision}:total`,
          notes: `Purchase bill ${bill.invoiceNumber} total adjusted`,
          actorId,
          session,
        });
      }

      const supplier = await findSupplier(wholesalerId, bill.supplierId, session, { active: false });
      if (paidDifference > 0) {
        const [payment] = await PurchasePayment.create([paymentDocument({
          wholesalerId,
          supplierId: supplier._id,
          billId: bill._id,
          amount: paidDifference,
          paymentDate: payload.paymentDate || calculated.billDate,
          paymentMode: payload.paymentMode || bill.paymentMode,
          notes: 'Additional payment recorded while editing bill',
          source: 'BILL',
          allocations: [{ billId: bill._id, amount: paidDifference }],
          idempotencyKey: `bill:${bill._id}:revision:${newRevision}:payment`,
          createdBy: actorId,
        })], { session });
        await appendLedger({
          wholesalerId,
          supplier,
          type: 'PAYMENT',
          amount: -paidDifference,
          effectiveDate: payment.paymentDate,
          referenceType: 'PURCHASE_PAYMENT',
          referenceId: payment._id,
          transactionKey: `payment:${payment._id}`,
          notes: payment.notes,
          actorId,
          session,
        });
      } else if (paidDifference < 0) {
        if (!payload.confirmPaymentRefund) {
          throw new BadRequestError(
            'Reducing the paid amount requires confirmation that the supplier refund was received.',
            'PAYMENT_REFUND_CONFIRMATION_REQUIRED'
          );
        }
        if (!payload.paymentMode && !bill.paymentMode) {
          throw new BadRequestError('Select the mode in which the supplier refund was received.', 'REFUND_MODE_REQUIRED');
        }
        const refundAmount = Math.abs(paidDifference);
        const [payment] = await PurchasePayment.create([paymentDocument({
          wholesalerId,
          supplierId: supplier._id,
          billId: bill._id,
          amount: refundAmount,
          direction: 'REFUND_RECEIVED',
          paymentDate: payload.paymentDate || calculated.billDate,
          paymentMode: payload.paymentMode || bill.paymentMode,
          notes: 'Supplier refund received while editing bill',
          source: 'BILL',
          allocations: [{ billId: bill._id, amount: refundAmount }],
          idempotencyKey: `bill:${bill._id}:revision:${newRevision}:refund`,
          createdBy: actorId,
        })], { session });
        await appendLedger({
          wholesalerId,
          supplier,
          type: 'PAYMENT',
          amount: refundAmount,
          effectiveDate: payment.paymentDate,
          referenceType: 'PURCHASE_PAYMENT',
          referenceId: payment._id,
          transactionKey: `payment:${payment._id}`,
          notes: payment.notes,
          actorId,
          session,
        });
      }

      bill.set({
        ...calculated,
        paidAmount: newPaidAmount,
        outstandingAmount: Math.max(0, roundMoney(calculated.totalAmount - newPaidAmount - bill.returnAmount + bill.refundedAmount)),
        paymentStatus: paymentStatus(calculated.totalAmount, newPaidAmount, bill.returnAmount, bill.refundedAmount),
        revision: newRevision,
        items: calculated.items,
      });
      bill.items.forEach((item) => {
        item.stockAppliedQuantity = calculated.stockUpdateEnabled ? item.quantity : 0;
      });
      bill.auditHistory.push({
        action: 'UPDATED',
        actorId,
        at: new Date(),
        before,
        after: billSnapshot(bill),
      });
      await bill.save({ session });

      for (const item of bill.items) {
        const product = productsById.get(String(item.productId));
        if (Math.abs(Number(product.costPrice || 0) - Number(item.purchaseRate)) < 0.01) continue;
        const previousItem = before.items.find((candidate) => candidate.productId === String(item.productId));
        if (previousItem && Math.abs(Number(product.costPrice || 0) - Number(previousItem.purchaseRate)) < 0.01) {
          product.costPrice = item.purchaseRate;
          await product.save({ session });
        }
      }
      await applySellingPriceUpdates(
        productsById,
        payload.sellingPriceUpdates,
        new Set(bill.items.map((item) => String(item.productId))),
        session
      );
    });
    return this.getPurchase(wholesalerId, billId);
  }

  static async cancelPurchase(wholesalerId, actorId, billId, reason) {
    await inTransaction(async (session) => {
      const bill = await PurchaseBill.findOne({ _id: billId, wholesalerId }).session(session);
      if (!bill) throw new NotFoundError('Purchase bill not found.', 'PURCHASE_BILL_NOT_FOUND');
      if (bill.status === 'CANCELLED') return;
      if (bill.paidAmount > 0) {
        throw new ConflictError(
          'Reverse or settle the recorded supplier payments before cancelling this bill.',
          'PURCHASE_BILL_HAS_PAYMENTS'
        );
      }
      const activeReturns = await PurchaseReturn.exists({
        wholesalerId,
        purchaseBillId: bill._id,
        status: 'ACTIVE',
      }).session(session);
      if (activeReturns) {
        throw new ConflictError('Cancel active purchase returns before cancelling this bill.', 'PURCHASE_HAS_RETURNS');
      }
      const before = billSnapshot(bill);
      const productsById = await findProducts(wholesalerId, bill.items.map((item) => item.productId), session);
      const stockTotals = stockQuantityMap(bill.items, { useApplied: true });
      for (const [productId, quantity] of stockTotals) {
        if (quantity > 0) {
          await applyStockDelta({
            wholesalerId,
            product: productsById.get(productId),
            delta: -quantity,
            actorId,
            referenceType: 'CANCELLATION',
            referenceId: bill._id,
            notes: `Stock reversed for cancelled purchase bill ${bill.invoiceNumber}`,
            session,
          });
        }
      }
      const supplier = await findSupplier(wholesalerId, bill.supplierId, session, { active: false });
      await appendLedger({
        wholesalerId,
        supplier,
        type: 'REVERSAL',
        amount: -bill.totalAmount,
        effectiveDate: new Date(),
        referenceType: 'PURCHASE_BILL',
        referenceId: bill._id,
        transactionKey: `purchase:${bill._id}:cancel`,
        notes: reason,
        actorId,
        session,
      });
      bill.status = 'CANCELLED';
      bill.cancelledAt = new Date();
      bill.cancelledBy = actorId;
      bill.cancellationReason = reason;
      bill.outstandingAmount = 0;
      bill.auditHistory.push({
        action: 'CANCELLED',
        actorId,
        at: new Date(),
        reason,
        before,
        after: { ...billSnapshot(bill), status: 'CANCELLED' },
      });
      await bill.save({ session });
    });
    return this.getPurchase(wholesalerId, billId);
  }

  static async createSupplierPayment(wholesalerId, actorId, supplierId, payload) {
    let payment;
    await inTransaction(async (session) => {
      const existing = await PurchasePayment.findOne({
        wholesalerId,
        idempotencyKey: payload.idempotencyKey,
      }).session(session);
      if (existing) {
        payment = existing;
        return;
      }
      const supplier = await findSupplier(wholesalerId, supplierId, session);
      const bills = await PurchaseBill.find({
        wholesalerId,
        supplierId,
        status: 'ACTIVE',
        outstandingAmount: { $gt: 0 },
      }).sort({ dueDate: 1, billDate: 1, _id: 1 }).session(session);

      let remaining = roundMoney(payload.amount);
      const allocations = [];
      for (const bill of bills) {
        if (remaining <= 0) break;
        const applied = Math.min(remaining, bill.outstandingAmount);
        const amount = roundMoney(applied);
        if (amount <= 0) continue;
        bill.paidAmount = roundMoney(bill.paidAmount + amount);
        bill.outstandingAmount = Math.max(0, roundMoney(bill.totalAmount - bill.paidAmount - bill.returnAmount + bill.refundedAmount));
        bill.paymentStatus = paymentStatus(bill.totalAmount, bill.paidAmount, bill.returnAmount, bill.refundedAmount);
        await bill.save({ session });
        allocations.push({ billId: bill._id, amount });
        remaining = roundMoney(remaining - amount);
      }

      const [created] = await PurchasePayment.create([paymentDocument({
        wholesalerId,
        supplierId: supplier._id,
        amount: payload.amount,
        paymentDate: payload.paymentDate,
        paymentMode: payload.paymentMode,
        notes: payload.notes,
        source: 'SUPPLIER',
        allocations,
        idempotencyKey: payload.idempotencyKey,
        createdBy: actorId,
      })], { session });
      payment = created;
      await appendLedger({
        wholesalerId,
        supplier,
        type: 'PAYMENT',
        amount: -created.amount,
        effectiveDate: created.paymentDate,
        referenceType: 'PURCHASE_PAYMENT',
        referenceId: created._id,
        transactionKey: `payment:${created._id}`,
        notes: created.notes,
        actorId,
        session,
      });
    });
    return payment;
  }

  static async reverseSupplierPayment(wholesalerId, actorId, paymentId, reason) {
    await inTransaction(async (session) => {
      const payment = await PurchasePayment.findOne({ _id: paymentId, wholesalerId }).session(session);
      if (!payment) throw new NotFoundError('Supplier payment not found.', 'SUPPLIER_PAYMENT_NOT_FOUND');
      if (payment.status === 'REVERSED') return;
      if (payment.direction !== 'OUTGOING') {
        throw new ConflictError('This refund receipt cannot be reversed from this payment action.', 'PAYMENT_REVERSAL_NOT_ALLOWED');
      }

      const supplier = await findSupplier(wholesalerId, payment.supplierId, session, { active: false });
      for (const allocation of payment.allocations) {
        const bill = await PurchaseBill.findOne({
          _id: allocation.billId,
          wholesalerId,
          supplierId: supplier._id,
        }).session(session);
        if (!bill || bill.status !== 'ACTIVE') continue;
        bill.paidAmount = Math.max(0, roundMoney(bill.paidAmount - allocation.amount));
        bill.outstandingAmount = Math.max(0, roundMoney(bill.totalAmount - bill.paidAmount - bill.returnAmount + bill.refundedAmount));
        bill.paymentStatus = paymentStatus(bill.totalAmount, bill.paidAmount, bill.returnAmount, bill.refundedAmount);
        await bill.save({ session });
      }

      payment.status = 'REVERSED';
      payment.reversedAt = new Date();
      payment.reversedBy = actorId;
      payment.reversalReason = reason;
      await payment.save({ session });
      await appendLedger({
        wholesalerId,
        supplier,
        type: 'REVERSAL',
        amount: payment.amount,
        effectiveDate: new Date(),
        referenceType: 'PURCHASE_PAYMENT',
        referenceId: payment._id,
        transactionKey: `payment:${payment._id}:reversal`,
        notes: reason,
        actorId,
        session,
      });
    });
    return PurchasePayment.findOne({ _id: paymentId, wholesalerId }).lean();
  }

  static async listPurchaseReturns(wholesalerId, filters = {}) {
    const query = { wholesalerId };
    if (filters.supplierId) query.supplierId = filters.supplierId;
    if (filters.status && filters.status !== 'ALL') query.status = filters.status;
    const items = await PurchaseReturn.find(query)
      .populate('supplierId', 'name mobile')
      .populate('purchaseBillId', 'invoiceNumber billDate')
      .sort({ returnDate: -1, createdAt: -1 })
      .limit(Math.min(Number(filters.limit) || 100, 100))
      .lean();
    return items;
  }

  static async createPurchaseReturn(wholesalerId, actorId, payload) {
    let result;
    await inTransaction(async (session) => {
      const existing = await PurchaseReturn.findOne({
        wholesalerId,
        idempotencyKey: payload.idempotencyKey,
      }).session(session);
      if (existing) {
        result = existing;
        return;
      }
      const bill = await PurchaseBill.findOne({
        _id: payload.purchaseBillId,
        wholesalerId,
        status: 'ACTIVE',
      }).session(session);
      if (!bill) throw new NotFoundError('Active purchase bill not found.', 'PURCHASE_BILL_NOT_FOUND');
      const supplier = await findSupplier(wholesalerId, bill.supplierId, session, { active: false });
      const productsById = await findProducts(wholesalerId, bill.items.map((item) => item.productId), session);
      const selectedItems = [];
      const seen = new Set();

      for (const line of payload.items) {
        const billItem = bill.items.id(line.billItemId);
        if (!billItem) throw new BadRequestError('A return item does not belong to this purchase bill.', 'INVALID_RETURN_ITEM');
        if (seen.has(String(billItem._id))) {
          throw new BadRequestError('A product may appear only once in a return.', 'DUPLICATE_RETURN_ITEM');
        }
        seen.add(String(billItem._id));
        const remainingQty = roundQuantity(billItem.quantity - billItem.returnedQuantity);
        if (line.quantity > remainingQty) {
          throw new ConflictError(`${billItem.productName} has only ${remainingQty} ${billItem.unit} available to return.`, 'RETURN_QUANTITY_EXCEEDS_BILL');
        }

        const taxable = roundMoney(line.quantity * billItem.purchaseRate);
        const gstAmount = roundMoney(taxable * billItem.gstPercent / 100);
        const itemDiscount = bill.totalAmount > 0
          ? roundMoney(bill.discountAmount * billItem.itemTotal / (bill.subtotal + bill.gstTotal + bill.transportCharges + bill.loadingCharges))
          : 0;
        const returnAmount = roundMoney(
          Math.max(0, billItem.itemTotal - itemDiscount) * line.quantity / billItem.quantity
        );
        const product = productsById.get(String(billItem.productId));
        let stockReduced = false;
        let stockNote = '';
        const eligibleStock = roundQuantity(billItem.stockAppliedQuantity - billItem.stockReturnedQuantity);
        if (eligibleStock >= line.quantity && eligibleStock > 0) {
          const inventory = await Inventory.findOne({
            wholesalerId,
            productId: billItem.productId,
          }).session(session);
          if (inventory && inventory.available >= line.quantity) {
            await applyStockDelta({
              wholesalerId,
              product,
              delta: -line.quantity,
              actorId,
              referenceType: 'RETURN',
              referenceId: payload.idempotencyKey,
              notes: `Purchase return from bill ${bill.invoiceNumber}`,
              session,
              decreaseType: INVENTORY_TRANSACTION_TYPE.RETURN,
            });
            stockReduced = true;
            billItem.stockReturnedQuantity = roundQuantity(billItem.stockReturnedQuantity + line.quantity);
          } else {
            stockNote = 'Available inventory is insufficient; stock was not changed.';
          }
        } else {
          stockNote = 'This purchase did not add this quantity to inventory.';
        }

        billItem.returnedQuantity = roundQuantity(billItem.returnedQuantity + line.quantity);
        selectedItems.push({
          billItemId: billItem._id,
          productId: billItem.productId,
          productName: billItem.productName,
          quantity: line.quantity,
          unit: billItem.unit,
          purchaseRate: billItem.purchaseRate,
          gstPercent: billItem.gstPercent,
          returnAmount,
          stockReduced,
          stockNote,
        });
      }

      const returnAmount = roundMoney(selectedItems.reduce((sum, item) => sum + item.returnAmount, 0));
      if (payload.refundStatus === 'REFUNDED' && returnAmount <= 0) {
        throw new BadRequestError('A zero-value purchase return cannot record a cash refund.', 'ZERO_VALUE_REFUND');
      }
      if (payload.refundStatus === 'REFUNDED' &&
        returnAmount > roundMoney(bill.paidAmount - bill.refundedAmount)) {
        throw new ConflictError(
          'A cash refund cannot exceed the amount paid to this supplier. Use Adjusted or Pending instead.',
          'REFUND_EXCEEDS_PAID_AMOUNT'
        );
      }
      const [purchaseReturn] = await PurchaseReturn.create([{
        wholesalerId,
        supplierId: supplier._id,
        purchaseBillId: bill._id,
        returnDate: payload.returnDate,
        items: selectedItems,
        returnAmount,
        reason: payload.reason,
        refundStatus: payload.refundStatus,
        refundMode: payload.refundMode || '',
        notes: payload.notes,
        idempotencyKey: payload.idempotencyKey,
        createdBy: actorId,
        auditHistory: [{ action: 'CREATED', actorId, at: new Date() }],
      }], { session });
      bill.returnAmount = roundMoney(bill.returnAmount + returnAmount);
      if (payload.refundStatus === 'REFUNDED') {
        bill.refundedAmount = roundMoney(bill.refundedAmount + returnAmount);
      }
      bill.outstandingAmount = Math.max(0, roundMoney(
        bill.totalAmount - bill.paidAmount - bill.returnAmount + bill.refundedAmount
      ));
      bill.paymentStatus = paymentStatus(
        bill.totalAmount,
        bill.paidAmount,
        bill.returnAmount,
        bill.refundedAmount
      );
      await bill.save({ session });
      await appendLedger({
        wholesalerId,
        supplier,
        type: 'PURCHASE_RETURN',
        amount: -returnAmount,
        effectiveDate: purchaseReturn.returnDate,
        referenceType: 'PURCHASE_RETURN',
        referenceId: purchaseReturn._id,
        transactionKey: `purchase-return:${purchaseReturn._id}`,
        notes: `${payload.reason}: ${payload.notes || bill.invoiceNumber}`,
        actorId,
        session,
      });
      if (purchaseReturn.refundStatus === 'REFUNDED') {
        const [refundPayment] = await PurchasePayment.create([paymentDocument({
          wholesalerId,
          supplierId: supplier._id,
          billId: bill._id,
          amount: returnAmount,
          direction: 'REFUND_RECEIVED',
          paymentDate: purchaseReturn.returnDate,
          paymentMode: purchaseReturn.refundMode,
          notes: `Supplier refund for purchase return ${purchaseReturn._id}`,
          source: 'BILL',
          allocations: [{ billId: bill._id, amount: returnAmount }],
          idempotencyKey: `return:${purchaseReturn._id}:refund`,
          createdBy: actorId,
        })], { session });
        await appendLedger({
          wholesalerId,
          supplier,
          type: 'PAYMENT',
          amount: refundPayment.amount,
          effectiveDate: refundPayment.paymentDate,
          referenceType: 'PURCHASE_PAYMENT',
          referenceId: refundPayment._id,
          transactionKey: `payment:${refundPayment._id}`,
          notes: refundPayment.notes,
          actorId,
          session,
        });
      }
      result = purchaseReturn;
    });
    return result;
  }

  static async cancelPurchaseReturn(wholesalerId, actorId, returnId, reason) {
    await inTransaction(async (session) => {
      const purchaseReturn = await PurchaseReturn.findOne({ _id: returnId, wholesalerId }).session(session);
      if (!purchaseReturn) throw new NotFoundError('Purchase return not found.', 'PURCHASE_RETURN_NOT_FOUND');
      if (purchaseReturn.status === 'CANCELLED') return;
      const bill = await PurchaseBill.findOne({ _id: purchaseReturn.purchaseBillId, wholesalerId }).session(session);
      if (!bill) throw new NotFoundError('Original purchase bill not found.', 'PURCHASE_BILL_NOT_FOUND');
      const supplier = await findSupplier(wholesalerId, purchaseReturn.supplierId, session, { active: false });
      const productsById = await findProducts(wholesalerId, purchaseReturn.items.map((item) => item.productId), session);

      purchaseReturn.items.forEach((returnedItem) => {
        const billItem = bill.items.id(returnedItem.billItemId);
        if (billItem) {
          billItem.returnedQuantity = Math.max(0, roundQuantity(billItem.returnedQuantity - returnedItem.quantity));
          if (returnedItem.stockReduced) {
            billItem.stockReturnedQuantity = Math.max(
              0,
              roundQuantity(billItem.stockReturnedQuantity - returnedItem.quantity)
            );
          }
        }
      });
      for (const returnedItem of purchaseReturn.items) {
        if (returnedItem.stockReduced) {
          await applyStockDelta({
            wholesalerId,
            product: productsById.get(String(returnedItem.productId)),
            delta: returnedItem.quantity,
            actorId,
            referenceType: 'RETURN',
            referenceId: purchaseReturn._id,
            notes: `Stock restored for cancelled purchase return ${purchaseReturn._id}`,
            session,
          });
        }
      }

      bill.returnAmount = Math.max(0, roundMoney(bill.returnAmount - purchaseReturn.returnAmount));
      if (purchaseReturn.refundStatus === 'REFUNDED') {
        bill.refundedAmount = Math.max(0, roundMoney(bill.refundedAmount - purchaseReturn.returnAmount));
        const refundPayment = await PurchasePayment.findOne({
          wholesalerId,
          idempotencyKey: `return:${purchaseReturn._id}:refund`,
          status: 'POSTED',
        }).session(session);
        if (!refundPayment) {
          throw new AppError('Supplier refund record is missing for this purchase return.', 500, 'PURCHASE_REFUND_RECORD_MISSING');
        }
        refundPayment.status = 'REVERSED';
        refundPayment.reversedAt = new Date();
        refundPayment.reversedBy = actorId;
        refundPayment.reversalReason = reason;
        await refundPayment.save({ session });
        await appendLedger({
          wholesalerId,
          supplier,
          type: 'REVERSAL',
          amount: -refundPayment.amount,
          effectiveDate: new Date(),
          referenceType: 'PURCHASE_PAYMENT',
          referenceId: refundPayment._id,
          transactionKey: `payment:${refundPayment._id}:reversal`,
          notes: reason,
          actorId,
          session,
        });
      }
      bill.outstandingAmount = Math.max(0, roundMoney(
        bill.totalAmount - bill.paidAmount - bill.returnAmount + bill.refundedAmount
      ));
      bill.paymentStatus = paymentStatus(
        bill.totalAmount,
        bill.paidAmount,
        bill.returnAmount,
        bill.refundedAmount
      );
      await bill.save({ session });

      purchaseReturn.status = 'CANCELLED';
      purchaseReturn.cancelledAt = new Date();
      purchaseReturn.cancelledBy = actorId;
      purchaseReturn.cancellationReason = reason;
      purchaseReturn.auditHistory.push({ action: 'CANCELLED', actorId, at: new Date(), reason });
      await purchaseReturn.save({ session });
      await appendLedger({
        wholesalerId,
        supplier,
        type: 'REVERSAL',
        amount: purchaseReturn.returnAmount,
        effectiveDate: new Date(),
        referenceType: 'PURCHASE_RETURN',
        referenceId: purchaseReturn._id,
        transactionKey: `purchase-return:${purchaseReturn._id}:reversal`,
        notes: reason,
        actorId,
        session,
      });
    });
    return PurchaseReturn.findOne({ _id: returnId, wholesalerId }).lean();
  }
}

module.exports = {
  PurchasesService,
  calculateTotals,
  paymentStatus,
  unitKey,
};

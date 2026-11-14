const {
  calculateTotals,
  paymentStatus,
  PurchasesService,
} = require('../src/modules/purchases/purchases.service');
const PurchaseBill = require('../src/models/PurchaseBill');
const mongoose = require('mongoose');
const {
  purchaseSchema,
  purchaseReturnSchema,
  createSupplierSchema,
} = require('../src/modules/purchases/purchases.validation');

const productId = '507f1f77bcf86cd799439011';
const supplierId = '507f1f77bcf86cd799439012';
const billItemId = '507f1f77bcf86cd799439013';

function validBill(overrides = {}) {
  return {
    billType: 'FULL',
    supplierId,
    idempotencyKey: 'purchase-entry-01',
    invoiceNumber: 'INV-100',
    billDate: '2026-10-28',
    items: [{ productId, quantity: 2, unit: 'PIECES', purchaseRate: 50, gstPercent: 10 }],
    transportCharges: 5,
    loadingCharges: 3,
    discountType: 'AMOUNT',
    discountValue: 8,
    paymentAmount: 20,
    paymentMode: 'CASH',
    stockUpdateEnabled: true,
    ...overrides,
  };
}

describe('Wholesaler purchase validation and calculations', () => {
  test('calculates tax, charges, discounts, payment and stock quantity server-side', () => {
    const totals = calculateTotals(validBill(), new Map([[
      productId,
      { _id: productId, name: 'Tea carton', unit: 'pieces', status: 'ACTIVE' },
    ]]));

    expect(totals).toMatchObject({
      subtotal: 100,
      gstTotal: 10,
      transportCharges: 5,
      loadingCharges: 3,
      discountAmount: 8,
      totalAmount: 110,
      paidAmount: 20,
      outstandingAmount: 90,
      paymentStatus: 'PARTIAL',
      stockUpdateEnabled: true,
    });
    expect(totals.items[0]).toMatchObject({
      taxableAmount: 100,
      gstAmount: 10,
      itemTotal: 110,
      stockAppliedQuantity: 2,
    });
  });

  test('treats a received supplier refund as an increase in the remaining bill balance', () => {
    expect(paymentStatus(100, 50, 20, 20)).toBe('PARTIAL');
    expect(paymentStatus(100, 100, 10, 10)).toBe('PAID');
  });

  test('keeps quick entry stock disabled by default and requires one item', () => {
    const payload = {
      ...validBill({ billType: 'QUICK', invoiceNumber: '', stockUpdateEnabled: undefined }),
    };
    const validated = purchaseSchema.validate(payload);
    expect(validated.error).toBeUndefined();
    expect(validated.value.stockUpdateEnabled).toBe(false);
    expect(purchaseSchema.validate({
      ...payload,
      items: [...payload.items, { ...payload.items[0], productId: '507f1f77bcf86cd799439014' }],
    }).error).toBeDefined();
  });

  test('rejects invalid full bills, payment totals and product units', () => {
    expect(purchaseSchema.validate(validBill({ invoiceNumber: '' })).error).toBeDefined();
    expect(() => calculateTotals(
      validBill({ paymentAmount: 200 }),
      new Map([[productId, { _id: productId, name: 'Tea carton', unit: 'pieces' }]])
    )).toThrow(expect.objectContaining({ code: 'PAYMENT_EXCEEDS_BILL' }));
    expect(() => calculateTotals(
      validBill({ items: [{ productId, quantity: 2, unit: 'KG', purchaseRate: 50, gstPercent: 0 }] }),
      new Map([[productId, { _id: productId, name: 'Tea carton', unit: 'PIECES' }]])
    )).toThrow(expect.objectContaining({ code: 'PURCHASE_UNIT_MISMATCH' }));
  });

  test('requires genuine supplier contact details and refund mode for received returns', () => {
    expect(createSupplierSchema.validate({
      name: 'Local Supplier',
      mobile: '9876543210',
      openingBalance: 25,
    }).error).toBeUndefined();
    expect(createSupplierSchema.validate({
      name: 'Local Supplier',
      mobile: 'not-a-number',
    }).error).toBeDefined();

    const refund = {
      purchaseBillId: supplierId,
      returnDate: '2026-10-28',
      items: [{ billItemId, quantity: 1 }],
      reason: 'DAMAGED',
      refundStatus: 'REFUNDED',
      idempotencyKey: 'purchase-return-01',
    };
    expect(purchaseReturnSchema.validate(refund).error).toBeDefined();
    expect(purchaseReturnSchema.validate({ ...refund, refundMode: 'UPI' }).error).toBeUndefined();
  });

  test('checks bill duplicates without case-sensitive invoice number mismatches', async () => {
    let query;
    const findOne = jest.spyOn(PurchaseBill, 'findOne').mockImplementation((filter) => {
      query = filter;
      return { select: () => ({ lean: async () => null }) };
    });

    await expect(PurchasesService.checkDuplicate('507f1f77bcf86cd799439099', {
      supplierId,
      invoiceNumber: ' inv-100 ',
    })).resolves.toEqual({ duplicate: false, bill: null });
    expect(query.invoiceNumber).toBeInstanceOf(RegExp);
    expect(query.invoiceNumber.test('INV-100')).toBe(true);
    expect(query.wholesalerId).toBe('507f1f77bcf86cd799439099');
    findOne.mockRestore();
  });

  test('reports replica-set transaction requirements instead of partially saving purchases', async () => {
    const session = {
      withTransaction: jest.fn().mockRejectedValue(Object.assign(
        new Error('Transaction numbers are only allowed on a replica set member or mongos'),
        { code: 20, codeName: 'IllegalOperation' },
      )),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const startSession = jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);

    await expect(PurchasesService.createSupplier(
      '507f1f77bcf86cd799439099',
      '507f1f77bcf86cd799439098',
      { name: 'Local Supplier', mobile: '9876543210', address: '', gstin: '', openingBalance: 0 },
    )).rejects.toMatchObject({
      statusCode: 503,
      code: 'MONGODB_TRANSACTIONS_REQUIRED',
    });
    expect(session.endSession).toHaveBeenCalledTimes(1);
    startSession.mockRestore();
  });
});

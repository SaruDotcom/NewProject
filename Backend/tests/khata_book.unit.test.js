const KhataEntry = require('../src/models/KhataEntry');
const WholesalerProfile = require('../src/models/WholesalerProfile');
const { KhataBookService, calculateEntry, summarize } = require('../src/modules/khata-book/khata-book.service');
const { entrySchema, settingsSchema } = require('../src/modules/khata-book/khata-book.validation');

const validEntry = (overrides = {}) => ({
  date: '2026-10-28',
  productName: 'Kurti set',
  category: 'Ethnic wear',
  size: 'M',
  colour: 'Blue',
  unit: 'piece',
  brandModel: '',
  counterpartyName: 'ABC Supplier',
  quantity: 20,
  purchaseRate: 250,
  paidAmount: 5000,
  notes: '',
  ...overrides,
});

describe('Simple purchase Khata Book', () => {
  test('calculates total cost, pending amount, and payment status', () => {
    expect(calculateEntry(validEntry())).toMatchObject({
      transactionType: 'PURCHASE',
      purchaseAmount: 5000,
      pendingAmount: 0,
      paymentStatus: 'PAID',
    });
    expect(calculateEntry(validEntry({ paidAmount: 2000 }))).toMatchObject({
      purchaseAmount: 5000,
      pendingAmount: 3000,
      paymentStatus: 'PARTIAL',
    });
    expect(calculateEntry(validEntry({ paidAmount: 0 }))).toMatchObject({
      pendingAmount: 5000,
      paymentStatus: 'PENDING',
    });
  });

  test('validates purchase details, real dates, and payment limits', () => {
    expect(entrySchema.validate(validEntry()).error).toBeUndefined();
    expect(entrySchema.validate(validEntry({ date: '2026-02-31' })).error).toBeDefined();
    expect(entrySchema.validate(validEntry({ counterpartyName: '' })).error).toBeDefined();
    expect(entrySchema.validate(validEntry({ paidAmount: 5001 })).error).toBeDefined();
    expect(entrySchema.validate(validEntry({ quantity: 0 })).error).toBeDefined();
  });

  test('requires a valid business type and a name for other businesses', () => {
    expect(settingsSchema.validate({ businessType: 'CLOTHING' }).error).toBeUndefined();
    expect(settingsSchema.validate({ businessType: 'OTHER' }).error).toBeDefined();
    expect(settingsSchema.validate({ businessType: 'OTHER', otherBusinessType: 'Furniture' }).error).toBeUndefined();
    expect(settingsSchema.validate({ businessType: 'INVALID' }).error).toBeDefined();
  });

  test('summarizes purchase, paid, and pending totals', () => {
    const entries = [
      calculateEntry(validEntry({ quantity: 10, purchaseRate: 200, paidAmount: 1000 })),
      calculateEntry(validEntry({ quantity: 2, purchaseRate: 300, paidAmount: 0 })),
    ];
    expect(summarize(entries)).toEqual({ totalPurchase: 2600, totalPaid: 1000, totalPending: 1600 });
  });

  test('scopes list, update, and delete queries to the signed-in wholesaler', async () => {
    const wholesalerId = '507f1f77bcf86cd799439011';
    const entryId = '507f1f77bcf86cd799439012';
    const queries = [];
    const findSpy = jest.spyOn(KhataEntry, 'find').mockImplementation((query) => {
      queries.push(query);
      return { sort: () => ({ lean: async () => [] }) };
    });
    const updateSpy = jest.spyOn(KhataEntry, 'findOneAndUpdate').mockResolvedValue(null);
    const deleteSpy = jest.spyOn(KhataEntry, 'findOneAndDelete').mockResolvedValue(null);

    await KhataBookService.getEntries(wholesalerId);
    await expect(KhataBookService.updateEntry(wholesalerId, entryId, validEntry()))
      .rejects.toMatchObject({ code: 'KHATA_ENTRY_NOT_FOUND' });
    await expect(KhataBookService.deleteEntry(wholesalerId, entryId))
      .rejects.toMatchObject({ code: 'KHATA_ENTRY_NOT_FOUND' });

    expect(queries).toHaveLength(1);
    expect(queries.every((query) => String(query.wholesalerId) === wholesalerId)).toBe(true);
    expect(queries.every((query) => query.transactionType === 'PURCHASE')).toBe(true);
    expect(updateSpy.mock.calls[0][0]).toEqual({ _id: entryId, wholesalerId, transactionType: 'PURCHASE' });
    expect(deleteSpy.mock.calls[0][0]).toEqual({ _id: entryId, wholesalerId, transactionType: 'PURCHASE' });
    findSpy.mockRestore();
    updateSpy.mockRestore();
    deleteSpy.mockRestore();
  });

  test('saves entries under their owner and exports saved purchase data with business identity', async () => {
    const wholesalerId = '507f1f77bcf86cd799439011';
    const entry = validEntry();
    const createSpy = jest.spyOn(KhataEntry, 'create').mockImplementation(async (record) => record);
    const entriesSpy = jest.spyOn(KhataBookService, 'getEntries').mockResolvedValue({
      items: [{ ...calculateEntry(entry), ...entry }],
      summary: { totalPurchase: 5000, totalPaid: 5000, totalPending: 0 },
    });
    const profileSpy = jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
      select: () => ({ lean: async () => ({ businessName: 'Vyapar Dwar Textiles' }) }),
    });

    const created = await KhataBookService.createEntry(wholesalerId, entry);
    expect(created.wholesalerId).toBe(wholesalerId);
    const pdf = await KhataBookService.exportEntries(wholesalerId, { from: entry.date, to: entry.date }, 'pdf');
    const excel = await KhataBookService.exportEntries(wholesalerId, { from: entry.date, to: entry.date }, 'xlsx');

    expect(pdf.contentType).toBe('application/pdf');
    expect(pdf.buffer.toString('ascii', 0, 8)).toBe('%PDF-1.4');
    expect(pdf.buffer.toString('ascii')).toContain('Vyapar Dwar Textiles');
    expect(excel.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(excel.buffer.toString('ascii', 0, 2)).toBe('PK');

    createSpy.mockRestore();
    entriesSpy.mockRestore();
    profileSpy.mockRestore();
  });
});

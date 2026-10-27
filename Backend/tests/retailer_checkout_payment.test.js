const fs = require('fs');
const { Order, Payment, WholesalerProfile, WholesalerRetailerRelationship } = require('../src/models');
const OrderService = require('../src/modules/orders/orders.service');
const PaymentsService = require('../src/modules/payments/payments.service');
const AuditService = require('../src/services/audit.service');
const { checkoutSchema } = require('../src/modules/retailers/retailer.validation');

describe('Direct retailer checkout payments', () => {
  afterEach(() => jest.restoreAllMocks());

  test.each(['UPI', 'COD', 'CREDIT'])('checkout validation accepts %s', (paymentMethod) => {
    const result = checkoutSchema.validate({
      paymentMethod,
      items: [{ productId: '507f1f77bcf86cd799439011', quantity: 1 }],
      shippingAddress: {
        addressLine1: '1 Main Street',
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110001',
      },
    });

    expect(result.error).toBeUndefined();
  });

  test('checkout validation rejects the removed gateway method', () => {
    const result = checkoutSchema.validate({
      paymentMethod: 'ONLINE',
      shippingAddress: {
        addressLine1: '1 Main Street',
        city: 'Delhi',
        state: 'Delhi',
      },
    });

    expect(result.error).toBeDefined();
  });

  test('order service refuses gateway order creation directly', async () => {
    await expect(OrderService.createOrder(
      { _id: 'retailer-1' },
      { paymentMethod: 'ONLINE', items: [] },
    )).rejects.toMatchObject({ code: 'GATEWAY_CHECKOUT_DISABLED' });
  });

  test('UPI order and payment values remain valid model values', () => {
    expect(new Order({ paymentMethod: 'UPI' }).validateSync()?.errors?.paymentMethod).toBeUndefined();
    expect(new Payment({ paymentMethod: 'UPI', amount: 10 }).validateSync()?.errors?.paymentMethod).toBeUndefined();
  });

  test('payment options resolve only from the retailer active wholesaler', async () => {
    jest.spyOn(WholesalerRetailerRelationship, 'findOne').mockResolvedValue({
      wholesalerId: { toString: () => 'wholesaler-1' },
      status: 'ACTIVE',
    });
    const profile = {
      businessName: 'Trusted Textiles',
      paymentSettings: {
        accountName: 'Trusted Textiles',
        upiId: 'trusted@upi',
        upiIdPaymentsEnabled: true,
        qrPaymentsEnabled: false,
        qrSessionMinutes: 10,
      },
    };
    jest.spyOn(WholesalerProfile, 'findOne').mockResolvedValue(profile);

    const result = await PaymentsService.getRetailerPaymentOptions('retailer-1');

    expect(result).toMatchObject({
      wholesalerId: 'wholesaler-1',
      upiId: 'trusted@upi',
      upiIdPaymentsEnabled: true,
      qrPaymentsEnabled: false,
    });
  });

  test('retailer QR options and fresh sessions return the saved private image', async () => {
    jest.spyOn(WholesalerRetailerRelationship, 'findOne').mockResolvedValue({
      wholesalerId: { toString: () => 'wholesaler-1' },
      status: 'ACTIVE',
    });
    const profile = {
      businessName: 'Trusted Textiles',
      paymentSettings: {
        accountName: 'Trusted Textiles',
        upiId: 'trusted@upi',
        upiIdPaymentsEnabled: true,
        qrPaymentsEnabled: true,
        qrImagePath: 'saved-qr.png',
        qrImageMimeType: 'image/png',
        qrSessionMinutes: 10,
      },
    };
    const image = Buffer.from('saved-wholesaler-qr');
    jest.spyOn(WholesalerProfile, 'findOne').mockResolvedValue(profile);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(image);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);

    const options = await PaymentsService.getRetailerPaymentOptions('retailer-1');
    const session = await PaymentsService.createRetailerQrSession('retailer-1');

    expect(options).toMatchObject({
      upiId: 'trusted@upi',
      qrPaymentsEnabled: true,
      hasQrImage: true,
      qrDataUrl: `data:image/png;base64,${image.toString('base64')}`,
    });
    expect(session).toMatchObject({
      wholesalerId: 'wholesaler-1',
      qrDataUrl: options.qrDataUrl,
      qrSessionMinutes: 10,
    });
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
    expect(new Date(session.expiresAt).getTime()).toBeLessThanOrEqual(Date.now() + 10 * 60_000);
  });

  test('missing saved QR image disables QR checkout and fresh sessions fail clearly', async () => {
    jest.spyOn(WholesalerRetailerRelationship, 'findOne').mockResolvedValue({
      wholesalerId: { toString: () => 'wholesaler-1' },
      status: 'ACTIVE',
    });
    jest.spyOn(WholesalerProfile, 'findOne').mockResolvedValue({
      businessName: 'Trusted Textiles',
      paymentSettings: {
        upiId: 'trusted@upi',
        upiIdPaymentsEnabled: true,
        qrPaymentsEnabled: true,
        qrImagePath: 'missing-qr.png',
        qrImageMimeType: 'image/png',
      },
    });
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);

    await expect(PaymentsService.getRetailerPaymentOptions('retailer-1')).resolves.toMatchObject({
      qrPaymentsEnabled: false,
      hasQrImage: false,
      upiId: 'trusted@upi',
      upiIdPaymentsEnabled: true,
    });
    await expect(PaymentsService.createRetailerQrSession('retailer-1')).rejects.toMatchObject({
      code: 'QR_IMAGE_UNAVAILABLE',
    });
  });

  test('wholesaler cannot enable QR payments when the saved image file is missing', async () => {
    const profile = {
      paymentSettings: {
        qrImagePath: 'missing-qr.png',
        qrImageMimeType: 'image/png',
        qrPaymentsEnabled: false,
        upiIdPaymentsEnabled: false,
      },
      save: jest.fn(),
    };
    jest.spyOn(WholesalerProfile, 'findOne').mockResolvedValue(profile);
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    await expect(PaymentsService.updateSettings(
      'wholesaler-1',
      { qrPaymentsEnabled: true, upiIdPaymentsEnabled: false },
      null,
      { _id: 'wholesaler-1', role: 'WHOLESALER' },
      {},
    )).rejects.toMatchObject({ code: 'QR_IMAGE_REQUIRED' });
    expect(profile.save).not.toHaveBeenCalled();
  });

  test('payment settings reject malformed UPI IDs before saving', async () => {
    const profile = {
      paymentSettings: {},
      save: jest.fn(),
    };
    jest.spyOn(WholesalerProfile, 'findOne').mockResolvedValue(profile);
    jest.spyOn(AuditService, 'log').mockResolvedValue(undefined);

    await expect(PaymentsService.updateSettings(
      'wholesaler-1',
      { upiId: 'not-an-upi-id', upiIdPaymentsEnabled: true, qrPaymentsEnabled: false },
      null,
      { _id: 'wholesaler-1', role: 'WHOLESALER' },
      {},
    )).rejects.toMatchObject({ code: 'INVALID_UPI_ID' });
    expect(profile.save).not.toHaveBeenCalled();
  });
});

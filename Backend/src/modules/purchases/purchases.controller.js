const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { PurchasesService } = require('./purchases.service');

module.exports = {
  summary: asyncHandler(async (req, res) => {
    const summary = await PurchasesService.getDashboardSummary(req.user._id);
    return ApiResponse.success(res, summary, 'Purchase summary retrieved');
  }),

  listSuppliers: asyncHandler(async (req, res) => {
    const suppliers = await PurchasesService.listSuppliers(req.user._id, req.query);
    return ApiResponse.success(res, suppliers, 'Suppliers retrieved');
  }),

  createSupplier: asyncHandler(async (req, res) => {
    const supplier = await PurchasesService.createSupplier(req.user._id, req.user._id, req.body);
    return ApiResponse.created(res, supplier, 'Supplier created');
  }),

  updateSupplier: asyncHandler(async (req, res) => {
    const supplier = await PurchasesService.updateSupplier(req.user._id, req.params.supplierId, req.body);
    return ApiResponse.success(res, supplier, 'Supplier updated');
  }),

  deactivateSupplier: asyncHandler(async (req, res) => {
    const result = await PurchasesService.deactivateSupplier(req.user._id, req.params.supplierId);
    return ApiResponse.success(res, result, 'Supplier deactivated');
  }),

  getSupplier: asyncHandler(async (req, res) => {
    const supplier = await PurchasesService.getSupplier(req.user._id, req.params.supplierId);
    return ApiResponse.success(res, supplier, 'Supplier retrieved');
  }),

  getSupplierLedger: asyncHandler(async (req, res) => {
    const ledger = await PurchasesService.getSupplierLedger(
      req.user._id,
      req.params.supplierId,
      req.query
    );
    return ApiResponse.success(res, ledger, 'Supplier ledger retrieved');
  }),

  listSupplierPayments: asyncHandler(async (req, res) => {
    const payments = await PurchasesService.listSupplierPayments(req.user._id, req.params.supplierId);
    return ApiResponse.success(res, payments, 'Supplier payments retrieved');
  }),

  createSupplierPayment: asyncHandler(async (req, res) => {
    const payment = await PurchasesService.createSupplierPayment(
      req.user._id,
      req.user._id,
      req.params.supplierId,
      req.body
    );
    return ApiResponse.created(res, payment, 'Supplier payment recorded');
  }),

  reverseSupplierPayment: asyncHandler(async (req, res) => {
    const payment = await PurchasesService.reverseSupplierPayment(
      req.user._id,
      req.user._id,
      req.params.paymentId,
      req.body.reason
    );
    return ApiResponse.success(res, payment, 'Supplier payment reversed');
  }),

  checkDuplicate: asyncHandler(async (req, res) => {
    const result = await PurchasesService.checkDuplicate(req.user._id, req.query);
    return ApiResponse.success(res, result, 'Duplicate bill check completed');
  }),

  listPurchases: asyncHandler(async (req, res) => {
    const result = await PurchasesService.listPurchases(req.user._id, req.query);
    return ApiResponse.success(res, result, 'Purchase bills retrieved');
  }),

  getPurchase: asyncHandler(async (req, res) => {
    const bill = await PurchasesService.getPurchase(req.user._id, req.params.billId);
    return ApiResponse.success(res, bill, 'Purchase bill retrieved');
  }),

  createPurchase: asyncHandler(async (req, res) => {
    const bill = await PurchasesService.createPurchase(req.user._id, req.user._id, req.body);
    return ApiResponse.created(res, bill, 'Purchase bill created');
  }),

  updatePurchase: asyncHandler(async (req, res) => {
    const bill = await PurchasesService.updatePurchase(
      req.user._id,
      req.user._id,
      req.params.billId,
      req.body
    );
    return ApiResponse.success(res, bill, 'Purchase bill updated');
  }),

  cancelPurchase: asyncHandler(async (req, res) => {
    const bill = await PurchasesService.cancelPurchase(
      req.user._id,
      req.user._id,
      req.params.billId,
      req.body.reason
    );
    return ApiResponse.success(res, bill, 'Purchase bill cancelled');
  }),

  listReturns: asyncHandler(async (req, res) => {
    const returns = await PurchasesService.listPurchaseReturns(req.user._id, req.query);
    return ApiResponse.success(res, returns, 'Purchase returns retrieved');
  }),

  createReturn: asyncHandler(async (req, res) => {
    const purchaseReturn = await PurchasesService.createPurchaseReturn(
      req.user._id,
      req.user._id,
      req.body
    );
    return ApiResponse.created(res, purchaseReturn, 'Purchase return recorded');
  }),

  cancelReturn: asyncHandler(async (req, res) => {
    const purchaseReturn = await PurchasesService.cancelPurchaseReturn(
      req.user._id,
      req.user._id,
      req.params.returnId,
      req.body.reason
    );
    return ApiResponse.success(res, purchaseReturn, 'Purchase return cancelled');
  }),
};

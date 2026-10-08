const OrderService = require('./orders.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class OrderController {
  // Retailer places order
  createOrder = asyncHandler(async (req, res) => {
    const result = await OrderService.createOrder(req.user, req.body, req);
    return ApiResponse.created(res, result, 'Order placed successfully');
  });

  // Get list of orders (filtered by user role)
  listOrders = asyncHandler(async (req, res) => {
    const { orders, meta, filters } = await OrderService.listOrders(req.user, req.query);
    return ApiResponse.success(res, { items: orders, pagination: meta, filters }, 'Orders retrieved successfully');
  });

  // Get order by ID
  getOrderById = asyncHandler(async (req, res) => {
    const data = await OrderService.getOrderById(req.params.id, req.user);
    return ApiResponse.success(res, data, 'Order details retrieved');
  });

  // Update order status (Super Admin / Wholesaler)
  updateOrderStatus = asyncHandler(async (req, res) => {
    const order = await OrderService.updateOrderStatus(req.params.id, req.body, req.user, req);
    return ApiResponse.success(res, order, 'Order status updated successfully');
  });

  listReturns = asyncHandler(async (req, res) => {
    const { returns, meta } = await OrderService.listReturns(req.user, req.query);
    return ApiResponse.paginated(res, returns, meta, 'Returns retrieved successfully');
  });

  updateReturnStatus = asyncHandler(async (req, res) => {
    const returnDoc = await OrderService.updateReturnStatus(req.params.id, req.body.status, req.body.adminNotes, req.user);
    return ApiResponse.success(res, returnDoc, 'Return status updated successfully');
  });
}

module.exports = new OrderController();

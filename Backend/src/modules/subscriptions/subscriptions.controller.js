const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const SubscriptionService = require('./subscriptions.service');

const serializePlans = (plans) => plans.map((plan) => SubscriptionService.serializePlan(plan));

module.exports = {
  getPublicPlan: asyncHandler(async (_req, res) => {
    const plans = await SubscriptionService.getPlans();
    return ApiResponse.success(res, { plans: serializePlans(plans) }, 'Subscription plans retrieved');
  }),

  getAdminPlan: asyncHandler(async (_req, res) => {
    const [plans, subscriberData] = await Promise.all([
      SubscriptionService.getPlans({ includeInactive: true }),
      SubscriptionService.listSubscribers(),
    ]);
    return ApiResponse.success(res, {
      plans: serializePlans(plans),
      subscribers: subscriberData.subscribers,
      planCounts: subscriberData.planCounts,
    }, 'Subscription plans retrieved');
  }),

  createPlan: asyncHandler(async (req, res) => {
    const plan = await SubscriptionService.createPlan(req.body);
    return ApiResponse.success(res, { plan: SubscriptionService.serializePlan(plan) }, 'Subscription plan created', 201);
  }),

  updatePlan: asyncHandler(async (req, res) => {
    const plan = await SubscriptionService.updatePlan(req.params.planId, req.body);
    return ApiResponse.success(res, { plan: SubscriptionService.serializePlan(plan) }, 'Subscription plan updated');
  }),

  deletePlan: asyncHandler(async (req, res) => {
    await SubscriptionService.deletePlan(req.params.planId);
    return ApiResponse.success(res, {}, 'Subscription plan deleted');
  }),

  reorderPlans: asyncHandler(async (req, res) => {
    const plans = await SubscriptionService.reorderPlans(req.body.planIds);
    return ApiResponse.success(res, { plans: serializePlans(plans) }, 'Subscription plans reordered');
  }),

  addFeature: asyncHandler(async (req, res) => {
    const plan = await SubscriptionService.addFeature(req.params.planId, req.body);
    return ApiResponse.success(res, { plan: SubscriptionService.serializePlan(plan) }, 'Subscription feature added', 201);
  }),

  updateFeature: asyncHandler(async (req, res) => {
    const plan = await SubscriptionService.updateFeature(req.params.planId, req.params.featureId, req.body);
    return ApiResponse.success(res, { plan: SubscriptionService.serializePlan(plan) }, 'Subscription feature updated');
  }),

  removeFeature: asyncHandler(async (req, res) => {
    const plan = await SubscriptionService.removeFeature(req.params.planId, req.params.featureId);
    return ApiResponse.success(res, { plan: SubscriptionService.serializePlan(plan) }, 'Subscription feature removed');
  }),

  reorderFeatures: asyncHandler(async (req, res) => {
    const plan = await SubscriptionService.reorderFeatures(req.params.planId, req.body.featureIds);
    return ApiResponse.success(res, { plan: SubscriptionService.serializePlan(plan) }, 'Subscription features reordered');
  }),

  getWholesalerSubscription: asyncHandler(async (req, res) => (
    ApiResponse.success(res, await SubscriptionService.getWholesalerSubscription(req.user._id), 'Subscription retrieved')
  )),

  createOrder: asyncHandler(async (req, res) => {
    const result = await SubscriptionService.createOrder(req.user._id, req.body.planId);
    if (!result.configured) {
      return ApiResponse.success(res, result, 'Online payment is not configured');
    }
    return ApiResponse.success(res, result, 'Subscription payment order created', 201);
  }),

  verifyPayment: asyncHandler(async (req, res) => {
    const subscription = await SubscriptionService.verifyPayment(req.user._id, req.body);
    return ApiResponse.success(res, { subscription }, 'Subscription payment verified');
  }),
};

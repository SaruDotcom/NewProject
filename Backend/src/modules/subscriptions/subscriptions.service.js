const crypto = require('crypto');
const {
  SubscriptionPlan,
  SubscriptionPlanCatalog,
  SubscriptionPayment,
  WholesalerSubscription,
  WholesalerProfile,
} = require('../../models');
const env = require('../../config/env');
const { BadRequestError, ConflictError, NotFoundError } = require('../../utils/errors');

const CATALOG_KEY = 'WHOLESALER';
const CATALOG_VERSION = 3;
const CANONICAL_PLAN_KEYS = [
  'WHOLESALER_MONTHLY',
  'WHOLESALER_ANNUAL',
  'WHOLESALER_MEDIUM_MONTHLY',
  'WHOLESALER_MEDIUM_YEARLY',
  'WHOLESALER_499',
  'WHOLESALER_PRO_YEARLY',
];
const STARTER_FEATURES = [
  'Own storefront link',
  'Custom domain or subdomain',
  'Unlimited products',
  'Retailer onboarding by link',
  'Orders and inventory',
  'GST invoices',
  'Bulk Excel upload',
  'Reports',
  'Priority support',
];

const DEFAULT_PLANS = [
  {
    key: 'WHOLESALER_MONTHLY',
    name: 'Basic Monthly',
    price: 299,
    billingPeriod: 'MONTHLY',
    description: 'Core tools for your wholesale business, billed monthly.',
    taxNote: 'Taxes may apply.',
    isActive: true,
    order: 0,
    recommended: false,
  },
  {
    key: 'WHOLESALER_ANNUAL',
    name: 'Basic Yearly',
    price: 1499,
    billingPeriod: 'YEARLY',
    description: 'Core tools for your wholesale business, billed yearly.',
    taxNote: 'Taxes may apply.',
    isActive: true,
    order: 1,
    recommended: false,
  },
  {
    key: 'WHOLESALER_MEDIUM_MONTHLY',
    name: 'Medium Monthly',
    price: 399,
    billingPeriod: 'MONTHLY',
    description: 'More room to grow your wholesale business, billed monthly.',
    taxNote: 'Taxes may apply.',
    isActive: true,
    order: 2,
    recommended: true,
  },
  {
    key: 'WHOLESALER_MEDIUM_YEARLY',
    name: 'Medium Yearly',
    price: 2499,
    billingPeriod: 'YEARLY',
    description: 'More room to grow your wholesale business, billed yearly.',
    taxNote: 'Taxes may apply.',
    isActive: true,
    order: 3,
    recommended: true,
  },
  {
    key: 'WHOLESALER_499',
    name: 'Pro Monthly',
    price: 499,
    billingPeriod: 'MONTHLY',
    description: 'Advanced tools for your wholesale business, billed monthly.',
    taxNote: 'Taxes may apply.',
    isActive: true,
    order: 4,
    recommended: false,
  },
  {
    key: 'WHOLESALER_PRO_YEARLY',
    name: 'Pro Yearly',
    price: 4499,
    billingPeriod: 'YEARLY',
    description: 'Advanced tools for your wholesale business, billed yearly.',
    taxNote: 'Taxes may apply.',
    isActive: true,
    order: 5,
    recommended: false,
  },
].map((plan) => ({
  ...plan,
  features: STARTER_FEATURES.map((title, order) => ({ title, enabled: true, order })),
}));

function addCalendarPeriod(date, billingPeriod) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  if (billingPeriod === 'YEARLY') result.setFullYear(result.getFullYear() + 1);
  else result.setMonth(result.getMonth() + 1);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function configured() {
  return Boolean(env.RAZORPAY_KEY_ID.trim() && env.RAZORPAY_KEY_SECRET.trim());
}

class SubscriptionService {
  static async ensurePlanCatalog() {
    let catalog = await SubscriptionPlanCatalog.findOne({ key: CATALOG_KEY });
    if (catalog?.initialized && catalog.version >= CATALOG_VERSION) return;

    try {
      catalog = await SubscriptionPlanCatalog.findOneAndUpdate(
        { key: CATALOG_KEY },
        { $setOnInsert: { key: CATALOG_KEY, initialized: false } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      catalog = await SubscriptionPlanCatalog.findOne({ key: CATALOG_KEY });
    }

    await Promise.all(DEFAULT_PLANS.map(async (plan) => {
      try {
        await SubscriptionPlan.findOneAndUpdate(
          { key: plan.key },
          {
            $set: {
              name: plan.name,
              price: plan.price,
              billingPeriod: plan.billingPeriod,
              description: plan.description,
              taxNote: plan.taxNote,
              isActive: plan.isActive,
              order: plan.order,
              recommended: plan.recommended,
            },
            $setOnInsert: { features: plan.features },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
        await SubscriptionPlan.findOne({ key: plan.key });
      }
    }));
    await SubscriptionPlan.updateMany(
      { key: { $regex: '^WHOLESALER_', $nin: CANONICAL_PLAN_KEYS } },
      { $set: { isActive: false } },
    );
    await SubscriptionPlanCatalog.updateOne(
      { key: CATALOG_KEY },
      { $set: { initialized: true, version: CATALOG_VERSION } },
    );
  }

  static async getPlans({ includeInactive = false } = {}) {
    await this.ensurePlanCatalog();
    const query = includeInactive ? {} : { isActive: true };
    return SubscriptionPlan.find(query).sort({ order: 1, createdAt: 1 });
  }

  static async getCustomerPlans({ includeInactive = false } = {}) {
    await this.ensurePlanCatalog();
    const query = { key: { $in: CANONICAL_PLAN_KEYS } };
    if (!includeInactive) query.isActive = true;
    return SubscriptionPlan.find(query).sort({ order: 1, createdAt: 1 });
  }

  static async getPlan(planId) {
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) throw new NotFoundError('Subscription plan not found');
    return plan;
  }

  static validatePlanInput(payload, { creating = false } = {}) {
    const updates = {};
    for (const field of ['name', 'price', 'billingPeriod', 'description', 'taxNote', 'isActive', 'order', 'recommended']) {
      if (payload[field] !== undefined) updates[field] = payload[field];
    }
    if (creating && (!updates.name || updates.price === undefined || !updates.billingPeriod)) {
      throw new BadRequestError('Plan name, price, and billing period are required');
    }
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || !updates.name.trim()) throw new BadRequestError('Plan name is required');
      updates.name = updates.name.trim();
    }
    if (updates.price !== undefined) {
      if (!Number.isFinite(Number(updates.price)) || Number(updates.price) < 0) {
        throw new BadRequestError('Plan price must be a non-negative number');
      }
      updates.price = Number(updates.price);
    }
    if (updates.billingPeriod !== undefined && !['MONTHLY', 'YEARLY'].includes(updates.billingPeriod)) {
      throw new BadRequestError('Billing period must be MONTHLY or YEARLY');
    }
    for (const field of ['isActive', 'recommended']) {
      if (updates[field] !== undefined && typeof updates[field] !== 'boolean') {
        throw new BadRequestError(`${field} must be a boolean`);
      }
    }
    if (updates.order !== undefined && (!Number.isInteger(Number(updates.order)) || Number(updates.order) < 0)) {
      throw new BadRequestError('Plan order must be a non-negative integer');
    }
    if (updates.order !== undefined) updates.order = Number(updates.order);
    if (updates.description !== undefined) updates.description = String(updates.description).trim();
    if (updates.taxNote !== undefined) updates.taxNote = String(updates.taxNote).trim();
    return updates;
  }

  static async createPlan(payload) {
    await this.ensurePlanCatalog();
    const values = this.validatePlanInput(payload, { creating: true });
    const lastPlan = await SubscriptionPlan.findOne().sort({ order: -1 }).select('order').lean();
    return SubscriptionPlan.create({
      ...values,
      key: `PLAN_${crypto.randomUUID()}`,
      order: values.order ?? (lastPlan ? lastPlan.order + 1 : 0),
      features: [],
    });
  }

  static async updatePlan(planId, payload) {
    const updates = this.validatePlanInput(payload);
    const existing = await this.getPlan(planId);
    if (
      CANONICAL_PLAN_KEYS.includes(existing.key) &&
      ((updates.name !== undefined && updates.name !== existing.name) ||
        (updates.price !== undefined && updates.price !== existing.price) ||
        (updates.billingPeriod !== undefined && updates.billingPeriod !== existing.billingPeriod) ||
        updates.isActive === false)
    ) {
      throw new BadRequestError('The six standard wholesaler plans and their prices cannot be changed');
    }
    const plan = await SubscriptionPlan.findByIdAndUpdate(
      planId,
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!plan) throw new NotFoundError('Subscription plan not found');
    return plan;
  }

  static async deletePlan(planId) {
    const existing = await this.getPlan(planId);
    if (CANONICAL_PLAN_KEYS.includes(existing.key)) {
      throw new BadRequestError('The six standard wholesaler plans cannot be deleted');
    }
    const plan = await SubscriptionPlan.findByIdAndDelete(planId);
    if (!plan) throw new NotFoundError('Subscription plan not found');
    return plan;
  }

  static async reorderPlans(planIds) {
    const plans = await this.getPlans({ includeInactive: true });
    if (!Array.isArray(planIds) || planIds.length !== plans.length) {
      throw new BadRequestError('Provide each plan ID exactly once to reorder plans');
    }
    const knownIds = new Set(plans.map((plan) => String(plan._id)));
    if (new Set(planIds).size !== planIds.length || planIds.some((id) => !knownIds.has(String(id)))) {
      throw new BadRequestError('Plan order contains invalid or duplicate IDs');
    }
    await Promise.all(planIds.map((id, order) => SubscriptionPlan.updateOne({ _id: id }, { $set: { order } })));
    return this.getPlans({ includeInactive: true });
  }

  static async addFeature(planId, { title, enabled = true }) {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) throw new BadRequestError('Feature title is required');
    const plan = await this.getPlan(planId);
    plan.features.push({ title: cleanTitle, enabled: Boolean(enabled), order: plan.features.length });
    await plan.save();
    return plan;
  }

  static async updateFeature(planId, featureId, payload) {
    const plan = await this.getPlan(planId);
    const feature = plan.features.id(featureId);
    if (!feature) throw new NotFoundError('Subscription feature not found');
    if (payload.title !== undefined) {
      const title = String(payload.title).trim();
      if (!title) throw new BadRequestError('Feature title is required');
      feature.title = title;
    }
    if (payload.enabled !== undefined) {
      if (typeof payload.enabled !== 'boolean') throw new BadRequestError('Feature enabled must be a boolean');
      feature.enabled = payload.enabled;
    }
    await plan.save();
    return plan;
  }

  static async removeFeature(planId, featureId) {
    const plan = await this.getPlan(planId);
    if (!plan.features.id(featureId)) throw new NotFoundError('Subscription feature not found');
    plan.features.pull(featureId);
    plan.features.forEach((feature, order) => { feature.order = order; });
    await plan.save();
    return plan;
  }

  static async reorderFeatures(planId, featureIds) {
    const plan = await this.getPlan(planId);
    if (!Array.isArray(featureIds) || featureIds.length !== plan.features.length) {
      throw new BadRequestError('Provide each feature ID exactly once to reorder features');
    }
    const featureById = new Map(plan.features.map((feature) => [String(feature._id), feature]));
    if (new Set(featureIds).size !== featureIds.length || featureIds.some((id) => !featureById.has(String(id)))) {
      throw new BadRequestError('Feature order contains invalid or duplicate IDs');
    }
    plan.features = featureIds.map((id, order) => {
      const feature = featureById.get(String(id));
      feature.order = order;
      return feature;
    });
    await plan.save();
    return plan;
  }

  static async listSubscribers() {
    const now = new Date();
    const [subscriptions, pendingPayments] = await Promise.all([
      WholesalerSubscription.find()
        .sort({ renewalDate: -1 })
        .populate({ path: 'userId', select: 'name email phone' })
        .populate({ path: 'wholesalerProfileId', select: 'businessName kycStatus' })
        .lean(),
      SubscriptionPayment.find({ status: 'PAID', approvalStatus: 'PENDING' })
        .sort({ verifiedAt: 1, createdAt: 1 })
        .populate({ path: 'userId', select: 'name email phone' })
        .populate({ path: 'wholesalerProfileId', select: 'businessName kycStatus' })
        .lean(),
    ]);
    const counts = new Map();
    subscriptions.forEach((subscription) => {
      const planId = String(subscription.planId);
      counts.set(planId, (counts.get(planId) || 0) + 1);
    });
    const plans = await this.getPlans({ includeInactive: true });
    const planCounts = Object.fromEntries(plans.map((plan) => [String(plan._id), counts.get(String(plan._id)) || 0]));
    return {
      subscribers: subscriptions.map((subscription) => ({
        ...subscription,
        billingPeriod: subscription.billingPeriod || 'MONTHLY',
        planName: subscription.planName || 'Subscription plan',
        status: subscription.renewalDate <= now ? 'EXPIRED' : subscription.status,
        wholesaler: subscription.wholesalerProfileId,
        user: subscription.userId,
      })),
      pendingApprovals: pendingPayments.map((payment) => ({
        ...this.serializePayment(payment),
        wholesaler: payment.wholesalerProfileId,
        user: payment.userId,
        kycStatus: payment.wholesalerProfileId?.kycStatus || 'UNKNOWN',
      })),
      planCounts,
    };
  }

  static async getWholesalerSubscription(userId) {
    const [allPlans, profile, subscription, payments] = await Promise.all([
      this.getCustomerPlans({ includeInactive: true }),
      WholesalerProfile.findOne({ userId, isDeleted: false }).select('_id'),
      WholesalerSubscription.findOne({ userId }),
      SubscriptionPayment.find({ userId }).sort({ createdAt: -1 }).lean(),
    ]);
    if (!profile) throw new NotFoundError('Wholesaler profile not found');
    const renewalTime = subscription?.renewalDate ? new Date(subscription.renewalDate).getTime() : 0;
    if (subscription?.status === 'ACTIVE' && renewalTime <= Date.now()) {
      subscription.status = 'EXPIRED';
      await subscription.save();
    }
    const plans = allPlans.filter((plan) => (
      plan.isActive || (subscription && String(plan._id) === String(subscription.planId))
    ));
    return {
      plans: plans.map((plan) => this.serializePlan(plan)),
      subscription: subscription ? this.serializeSubscription(subscription) : null,
      payments: (payments || []).map((payment) => this.serializePayment(payment)),
      payment: { configured: configured() },
    };
  }

  static serializePlan(plan) {
    return {
      id: String(plan._id),
      key: plan.key,
      name: plan.name,
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      description: plan.description,
      taxNote: plan.taxNote,
      isActive: plan.isActive,
      order: plan.order,
      recommended: plan.recommended,
      features: [...plan.features].sort((a, b) => a.order - b.order).map((feature) => ({
        id: String(feature._id),
        title: feature.title,
        enabled: feature.enabled,
        order: feature.order,
      })),
    };
  }

  static serializeSubscription(subscription) {
    return {
      ...(typeof subscription.toObject === 'function' ? subscription.toObject() : subscription),
      planName: subscription.planName || 'Subscription plan',
      billingPeriod: subscription.billingPeriod || 'MONTHLY',
      paymentMethod: subscription.paymentMethod || '',
    };
  }

  static serializePayment(payment) {
    return {
      id: String(payment._id),
      planId: String(payment.planId),
      planName: payment.planName,
      billingPeriod: payment.billingPeriod || 'MONTHLY',
      amount: payment.amount,
      amountPaise: payment.amountPaise,
      currency: payment.currency || 'INR',
      status: payment.status,
      approvalStatus: payment.approvalStatus || 'APPROVED',
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId || '',
      paymentMethod: payment.paymentMethod || '',
      errorReason: payment.errorReason || '',
      verifiedAt: payment.verifiedAt || null,
      approvedAt: payment.approvedAt || null,
      createdAt: payment.createdAt,
    };
  }

  static async getSubscriptionPayments(userId) {
    const payments = await SubscriptionPayment.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    return payments.map((payment) => this.serializePayment(payment));
  }

  static async createOrder(userId, planId) {
    if (!configured()) return { configured: false };
    if (!planId) throw new BadRequestError('A subscription plan is required');
    const pendingApproval = await SubscriptionPayment.exists({
      userId,
      status: 'PAID',
      approvalStatus: 'PENDING',
    });
    if (pendingApproval) {
      throw new ConflictError('A paid subscription is already awaiting Superadmin approval');
    }
    await this.ensurePlanCatalog();
    const [plan, profile] = await Promise.all([
      this.getPlan(planId),
      WholesalerProfile.findOne({ userId, isDeleted: false }).select('_id businessName'),
    ]);
    if (!profile) throw new NotFoundError('Wholesaler profile not found');
    if (!CANONICAL_PLAN_KEYS.includes(plan.key)) {
      throw new BadRequestError('Choose one of the six standard wholesaler subscription plans');
    }
    if (!plan.isActive) throw new ConflictError('Online subscriptions are currently unavailable');
    const amount = Math.round(plan.price * 100);
    const gatewayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: `sub_${String(userId).slice(-12)}_${Date.now()}`,
        notes: { userId: String(userId), planId: String(plan._id) },
      }),
    });
    const order = await gatewayResponse.json();
    if (!gatewayResponse.ok) {
      throw new BadRequestError(order.error?.description || 'Unable to create a Razorpay order', 'PAYMENT_ORDER_FAILED');
    }
    if (Number(order.amount) !== amount || order.currency !== 'INR') {
      throw new BadRequestError('Razorpay order does not match the selected subscription price', 'PAYMENT_ORDER_MISMATCH');
    }
    await SubscriptionPayment.create({
      userId,
      wholesalerProfileId: profile._id,
      planId: plan._id,
      planName: plan.name,
      billingPeriod: plan.billingPeriod,
      amount: plan.price,
      amountPaise: amount,
      currency: order.currency,
      razorpayOrderId: order.id,
    });
    return {
      configured: true,
      keyId: env.RAZORPAY_KEY_ID,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      plan: this.serializePlan(plan),
    };
  }

  static async verifyPayment(userId, payload) {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = payload || {};
    if (!orderId || !paymentId || !signature) throw new BadRequestError('Razorpay payment details are required');
    if (!configured()) throw new BadRequestError('Online payment is not configured', 'PAYMENT_NOT_CONFIGURED');

    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const suppliedBuffer = Buffer.from(String(signature));
    const expectedBuffer = Buffer.from(expected);
    if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
      throw new BadRequestError('Payment signature verification failed', 'INVALID_PAYMENT_SIGNATURE');
    }

    const profile = await WholesalerProfile.findOne({ userId, isDeleted: false }).select('_id');
    if (!profile) throw new NotFoundError('Wholesaler profile not found');
    const purchase = await SubscriptionPayment.findOne({ razorpayOrderId: orderId, userId });
    if (!purchase) throw new NotFoundError('Subscription order not found');
    if (purchase.status === 'PAID' && purchase.razorpayPaymentId === paymentId) {
      return WholesalerSubscription.findOne({ userId });
    }
    if (!['PENDING', 'FAILED', 'CANCELLED'].includes(purchase.status)) {
      throw new ConflictError('Subscription order has already been processed');
    }
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) {
      throw new BadRequestError(payment.error?.description || 'Unable to verify Razorpay payment', 'PAYMENT_VERIFICATION_FAILED');
    }
    if (
      payment.order_id !== orderId ||
      payment.currency !== 'INR' ||
      payment.amount !== purchase.amountPaise ||
      payment.status !== 'captured'
    ) {
      throw new BadRequestError('Captured payment does not match the saved subscription order', 'PAYMENT_NOT_CAPTURED');
    }

    const paymentMethod = payment.method || 'card';

    const paymentUpdate = await SubscriptionPayment.findOneAndUpdate(
      { _id: purchase._id, status: { $in: ['PENDING', 'FAILED', 'CANCELLED'] } },
      {
        $set: {
          status: 'PAID',
          approvalStatus: 'PENDING',
          razorpayPaymentId: paymentId,
          paymentMethod,
          verifiedAt: new Date(),
          errorReason: '',
        },
      },
      { new: true },
    );
    if (!paymentUpdate) {
      const currentPayment = await SubscriptionPayment.findById(purchase._id);
      if (currentPayment?.status === 'PAID' && currentPayment.razorpayPaymentId === paymentId) {
        return WholesalerSubscription.findOne({ userId });
      }
      throw new ConflictError('Subscription order has already been processed');
    }

    return WholesalerSubscription.findOne({ userId });
  }

  static async approvePayment(paymentId, adminId) {
    const payment = await SubscriptionPayment.findById(paymentId);
    if (!payment) throw new NotFoundError('Subscription payment not found');
    if (payment.status !== 'PAID') throw new ConflictError('Only verified subscription payments can be approved');
    if (payment.approvalStatus === 'APPROVED') {
      return {
        payment: this.serializePayment(payment),
        subscription: await WholesalerSubscription.findOne({ userId: payment.userId }),
      };
    }

    const profile = await WholesalerProfile.findOne({ userId: payment.userId, isDeleted: false })
      .select('_id kycStatus');
    if (!profile) throw new NotFoundError('Wholesaler profile not found');
    if (String(profile.kycStatus || '').trim().toUpperCase() !== 'APPROVED') {
      throw new ConflictError('Wholesaler KYC must be approved before approving a subscription');
    }

    const now = new Date();
    let subscription = await WholesalerSubscription.findOne({ userId: payment.userId });
    if (subscription?.razorpayPaymentId !== payment.razorpayPaymentId) {
      const continuesActiveTerm = subscription?.status === 'ACTIVE' && subscription.renewalDate > now;
      const startsAt = continuesActiveTerm ? subscription.renewalDate : now;
      const renewalDate = addCalendarPeriod(startsAt, payment.billingPeriod || 'MONTHLY');
      const update = {
        $set: {
          wholesalerProfileId: profile._id,
          planId: payment.planId,
          planName: payment.planName,
          billingPeriod: payment.billingPeriod || 'MONTHLY',
          amount: payment.amount,
          currency: 'INR',
          paymentMethod: payment.paymentMethod || '',
          status: 'ACTIVE',
          startedAt: continuesActiveTerm ? subscription.startedAt : now,
          renewalDate,
          razorpayOrderId: payment.razorpayOrderId,
          razorpayPaymentId: payment.razorpayPaymentId,
        },
      };

      try {
        subscription = subscription
          ? await WholesalerSubscription.findOneAndUpdate(
            { _id: subscription._id, razorpayPaymentId: subscription.razorpayPaymentId },
            update,
            { new: true, runValidators: true },
          )
          : await WholesalerSubscription.findOneAndUpdate(
            { userId: payment.userId },
            update,
            { new: true, upsert: true, runValidators: true },
          );
      } catch (error) {
        if (error.code !== 11000) throw error;
      }

      if (!subscription) {
        subscription = await WholesalerSubscription.findOne({ userId: payment.userId });
        if (subscription?.razorpayPaymentId !== payment.razorpayPaymentId) {
          throw new ConflictError('Subscription approval is already being processed');
        }
      }
    }

    const approvedPayment = await SubscriptionPayment.findOneAndUpdate(
      { _id: payment._id, status: 'PAID', approvalStatus: 'PENDING' },
      { $set: { approvalStatus: 'APPROVED', approvedAt: now, approvedBy: adminId } },
      { new: true },
    );
    if (!approvedPayment) {
      const currentPayment = await SubscriptionPayment.findById(payment._id);
      if (currentPayment?.approvalStatus !== 'APPROVED') {
        throw new ConflictError('Subscription approval is already being processed');
      }
      return { payment: this.serializePayment(currentPayment), subscription };
    }
    return { payment: this.serializePayment(approvedPayment), subscription };
  }

  static async recordPaymentFailure(userId, payload) {
    const { razorpayOrderId, razorpayPaymentId, errorReason, paymentMethod } = payload || {};
    if (!razorpayOrderId) throw new BadRequestError('Razorpay order ID is required');
    const purchase = await SubscriptionPayment.findOne({ razorpayOrderId, userId });
    if (!purchase) throw new NotFoundError('Subscription order not found');
    if (purchase.status === 'PAID') return this.serializePayment(purchase);
    const failed = await SubscriptionPayment.findOneAndUpdate(
      { _id: purchase._id, status: { $in: ['PENDING', 'CANCELLED'] } },
      {
        $set: {
          status: 'FAILED',
          ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
          ...(errorReason ? { errorReason } : {}),
        },
      },
      { new: true },
    );
    return this.serializePayment(failed || await SubscriptionPayment.findById(purchase._id));
  }

  static async recordPaymentCancellation(userId, payload) {
    const { razorpayOrderId, reason } = payload || {};
    if (!razorpayOrderId) throw new BadRequestError('Razorpay order ID is required');
    const purchase = await SubscriptionPayment.findOne({ razorpayOrderId, userId });
    if (!purchase) throw new NotFoundError('Subscription order not found');
    if (purchase.status === 'PAID') return this.serializePayment(purchase);

    if (purchase.status === 'PENDING') {
      const cancelled = await SubscriptionPayment.findOneAndUpdate(
        { _id: purchase._id, status: 'PENDING' },
        { $set: { status: 'CANCELLED', ...(reason ? { errorReason: reason } : {}) } },
        { new: true },
      );
      if (cancelled) return this.serializePayment(cancelled);
    }
    return this.serializePayment(await SubscriptionPayment.findById(purchase._id));
  }
}

module.exports = SubscriptionService;

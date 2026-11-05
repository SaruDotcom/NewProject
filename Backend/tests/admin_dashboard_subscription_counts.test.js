const { setupTestDB, clearDatabase } = require('./setup');
const {
  User,
  WholesalerProfile,
  SubscriptionPlan,
  WholesalerSubscription,
  SubscriptionPayment,
} = require('../src/models');
const { ROLES, USER_STATUS } = require('../src/config/constants');
const AdminService = require('../src/modules/admins/admins.service');

setupTestDB();

describe('Admin dashboard subscription counts', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  test('counts current purchasers by plan and active wholesaler account status', async () => {
    const planDefinitions = [
      { key: 'WHOLESALER_MONTHLY', name: 'Basic Monthly', price: 299 },
      { key: 'WHOLESALER_ANNUAL', name: 'Basic Yearly', price: 1499 },
      { key: 'WHOLESALER_MEDIUM_MONTHLY', name: 'Medium Monthly', price: 399 },
      { key: 'WHOLESALER_MEDIUM_YEARLY', name: 'Medium Yearly', price: 2499 },
      { key: 'WHOLESALER_499', name: 'Pro Monthly', price: 499 },
      { key: 'WHOLESALER_PRO_YEARLY', name: 'Pro Yearly', price: 4499 },
    ];
    const plans = await SubscriptionPlan.create(planDefinitions);
    const passwordHash = await User.hashPassword('Test1234');
    const statuses = [
      USER_STATUS.ACTIVE,
      USER_STATUS.ACTIVE,
      USER_STATUS.BLOCKED,
      USER_STATUS.ACTIVE,
    ];
    const users = await Promise.all(statuses.map((status, index) => User.create({
      name: `Wholesaler ${index + 1}`,
      email: `wholesaler${index + 1}@example.com`,
      passwordHash,
      role: ROLES.WHOLESALER,
      status,
    })));

    await WholesalerProfile.create(users.map((user, index) => ({
      userId: user._id,
      businessName: `Business ${index + 1}`,
    })));

    const expiredUser = await User.create({
      name: 'Expired subscriber',
      email: 'expired@example.com',
      passwordHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: expiredUser._id,
      businessName: 'Expired subscriber business',
    });

    const renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const subscriptions = await WholesalerSubscription.create(users.map((user, index) => ({
      userId: user._id,
      planId: plans[index]._id,
      planName: plans[index].name,
      amount: plans[index].price,
      renewalDate,
    })));
    const expiredSubscription = await WholesalerSubscription.create({
      userId: expiredUser._id,
      planId: plans[0]._id,
      planName: plans[0].name,
      amount: plans[0].price,
      status: 'EXPIRED',
      renewalDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const initialStats = await AdminService.getDashboardStats();
    expect(initialStats.activeWholesalers).toBe(4);
    expect(initialStats.subscriptionUsers).toBe(4);
    expect(initialStats.subscriptionPlanCounts).toEqual({
      WHOLESALER_MONTHLY: 1,
      WHOLESALER_ANNUAL: 1,
      WHOLESALER_MEDIUM_MONTHLY: 1,
      WHOLESALER_MEDIUM_YEARLY: 1,
      WHOLESALER_499: 0,
      WHOLESALER_PRO_YEARLY: 0,
    });

    expiredSubscription.status = 'ACTIVE';
    expiredSubscription.renewalDate = renewalDate;
    await expiredSubscription.save();

    const renewedStats = await AdminService.getDashboardStats();
    expect(renewedStats.subscriptionUsers).toBe(5);
    expect(renewedStats.subscriptionPlanCounts.WHOLESALER_MONTHLY).toBe(2);

    subscriptions[0].planId = plans[4]._id;
    subscriptions[0].planName = plans[4].name;
    subscriptions[0].amount = plans[4].price;
    await subscriptions[0].save();

    const updatedStats = await AdminService.getDashboardStats();
    expect(updatedStats.subscriptionUsers).toBe(5);
    expect(updatedStats.subscriptionPlanCounts).toEqual({
      WHOLESALER_MONTHLY: 1,
      WHOLESALER_ANNUAL: 1,
      WHOLESALER_MEDIUM_MONTHLY: 1,
      WHOLESALER_MEDIUM_YEARLY: 1,
      WHOLESALER_499: 1,
      WHOLESALER_PRO_YEARLY: 0,
    });
  });

  test('returns genuine paid and pending activities newest first with current statuses', async () => {
    const plan = await SubscriptionPlan.create({
      key: 'WHOLESALER_MONTHLY',
      name: 'Basic Monthly',
      price: 299,
    });
    const passwordHash = await User.hashPassword('Test1234');
    const owner = await User.create({
      name: 'Current Owner',
      email: 'current-owner@example.com',
      passwordHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    const profile = await WholesalerProfile.create({
      userId: owner._id,
      businessName: 'Current Business',
    });
    const paidAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const renewalDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
    await WholesalerSubscription.create({
      userId: owner._id,
      wholesalerProfileId: profile._id,
      planId: plan._id,
      planName: plan.name,
      amount: plan.price,
      status: 'ACTIVE',
      startedAt: paidAt,
      renewalDate,
      razorpayOrderId: 'paid-order',
    });
    await SubscriptionPayment.create({
      userId: owner._id,
      wholesalerProfileId: profile._id,
      planId: plan._id,
      planName: plan.name,
      billingPeriod: 'MONTHLY',
      amount: plan.price,
      amountPaise: plan.price * 100,
      status: 'PAID',
      razorpayOrderId: 'paid-order',
      razorpayPaymentId: 'payment-confirmed',
      verifiedAt: paidAt,
    });

    const expiredOwner = await User.create({
      name: 'Expired Owner',
      email: 'expired-owner@example.com',
      passwordHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    const expiredProfile = await WholesalerProfile.create({
      userId: expiredOwner._id,
      businessName: 'Expired Business',
    });
    const expiredAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    await WholesalerSubscription.create({
      userId: expiredOwner._id,
      wholesalerProfileId: expiredProfile._id,
      planId: plan._id,
      planName: plan.name,
      amount: plan.price,
      status: 'EXPIRED',
      startedAt: expiredAt,
      renewalDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      razorpayOrderId: 'expired-order',
    });
    await SubscriptionPayment.create({
      userId: expiredOwner._id,
      wholesalerProfileId: expiredProfile._id,
      planId: plan._id,
      planName: plan.name,
      billingPeriod: 'MONTHLY',
      amount: plan.price,
      amountPaise: plan.price * 100,
      status: 'PAID',
      razorpayOrderId: 'expired-order',
      razorpayPaymentId: 'expired-payment',
      verifiedAt: expiredAt,
    });

    const pendingOwner = await User.create({
      name: 'Pending Owner',
      email: 'pending-owner@example.com',
      passwordHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    const pendingProfile = await WholesalerProfile.create({
      userId: pendingOwner._id,
      businessName: 'Pending Business',
    });
    await SubscriptionPayment.create({
      userId: pendingOwner._id,
      wholesalerProfileId: pendingProfile._id,
      planId: plan._id,
      planName: plan.name,
      billingPeriod: 'MONTHLY',
      amount: plan.price,
      amountPaise: plan.price * 100,
      status: 'PENDING',
      razorpayOrderId: 'pending-order',
    });
    const failed = await SubscriptionPayment.create({
      userId: pendingOwner._id,
      wholesalerProfileId: pendingProfile._id,
      planId: plan._id,
      planName: plan.name,
      amount: plan.price,
      amountPaise: plan.price * 100,
      status: 'FAILED',
      razorpayOrderId: 'failed-order',
    });

    const activities = await AdminService.getSubscriptionActivities();
    expect(activities).toHaveLength(3);
    expect(activities.map((activity) => activity.status)).toEqual(['PENDING', 'ACTIVE', 'EXPIRED']);
    expect(activities[0]).toMatchObject({
      businessName: 'Pending Business',
      ownerName: 'Pending Owner',
      planName: 'Basic Monthly',
      amount: 299,
      status: 'PENDING',
      expiryDate: null,
    });
    expect(activities[1]).toMatchObject({
      businessName: 'Current Business',
      ownerName: 'Current Owner',
      status: 'ACTIVE',
    });
    expect(new Date(activities[1].expiryDate)).toEqual(renewalDate);
    expect(activities[2]).toMatchObject({
      businessName: 'Expired Business',
      ownerName: 'Expired Owner',
      status: 'EXPIRED',
    });
    expect(activities.some((activity) => activity.id === String(failed._id))).toBe(false);
  });
});

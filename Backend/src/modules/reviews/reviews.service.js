const mongoose = require('mongoose');
const {
  Review,
  User,
  WholesalerProfile,
  RetailerProfile,
  WholesalerRetailerRelationship,
  Order,
} = require('../../models');
const { RELATIONSHIP_STATUS, ROLES } = require('../../config/constants');
const { BadRequestError, ConflictError, ForbiddenError } = require('../../utils/errors');

const CATEGORY_KEYS = ['productQuality', 'packaging', 'delivery', 'communication'];

function normalizeReview({ title = '', comment = '', rating, categoryRatings = {} }) {
  const normalizedComment = String(comment).trim();
  const normalizedTitle = String(title).trim();
  const numericRating = Number(rating);
  if (!normalizedComment || normalizedComment.length > 2000) {
    throw new BadRequestError('Review comment must contain 1 to 2000 characters');
  }
  if (normalizedTitle.length > 120) throw new BadRequestError('Review title must not exceed 120 characters');
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new BadRequestError('Rating must be a whole number from 1 to 5');
  }
  const normalizedRatings = {};
  for (const key of CATEGORY_KEYS) {
    const value = Number(categoryRatings[key]);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new BadRequestError(`Choose a ${key} rating from 1 to 5`);
    }
    normalizedRatings[key] = value;
  }
  return { normalizedComment, normalizedTitle, numericRating, normalizedRatings };
}

class ReviewsService {
  static async create(user, { recipientId, orderId, title = '', comment = '', rating, categoryRatings } = {}) {
    const reviewerRole = String(user.role || '').toUpperCase();
    if (reviewerRole !== ROLES.RETAILER) {
      throw new ForbiddenError('Only retailers can review wholesalers');
    }
    if (!mongoose.isValidObjectId(orderId)) throw new BadRequestError('A delivered order is required for a review');
    if (!mongoose.isValidObjectId(recipientId)) throw new BadRequestError('A valid wholesaler is required');

    const order = await Order.findOne({
      _id: orderId,
      retailerId: user._id,
      wholesalerId: recipientId,
      orderStatus: 'DELIVERED',
      isDemo: { $ne: true },
    }).select('_id wholesalerId');
    if (!order) throw new ForbiddenError('Reviews can only be submitted for your delivered orders');
    if (await Review.exists({ userId: user._id, orderId: order._id, isDeleted: false })) {
      throw new ConflictError('A review has already been submitted for this order.', 'ORDER_REVIEW_EXISTS');
    }

    const values = normalizeReview({ title, comment, rating, categoryRatings });
    try {
      return await Review.create({
        userId: user._id,
        userRole: ROLES.RETAILER,
        recipientId: order.wholesalerId,
        recipientRole: ROLES.WHOLESALER,
        wholesalerId: order.wholesalerId,
        orderId: order._id,
        title: values.normalizedTitle,
        comment: values.normalizedComment,
        rating: values.numericRating,
        categoryRatings: values.normalizedRatings,
        status: 'approved',
      });
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictError('A review has already been submitted for this order.', 'ORDER_REVIEW_EXISTS');
      }
      throw error;
    }
  }

  static async updateOwn(user, reviewId, payload = {}) {
    if (String(user.role || '').toUpperCase() !== ROLES.RETAILER) {
      throw new ForbiddenError('Only retailers can edit wholesaler reviews');
    }
    if (!mongoose.isValidObjectId(reviewId)) throw new BadRequestError('A valid review ID is required');
    const review = await Review.findOne({
      _id: reviewId,
      userId: user._id,
      userRole: ROLES.RETAILER,
      recipientRole: ROLES.WHOLESALER,
      isDeleted: false,
    });
    if (!review) throw new ForbiddenError('This review is not available to your account');
    const order = await Order.findOne({
      _id: review.orderId,
      retailerId: user._id,
      wholesalerId: review.recipientId,
      orderStatus: 'DELIVERED',
      isDemo: { $ne: true },
    }).select('_id');
    if (!order) throw new ForbiddenError('Reviews can only be edited for your delivered orders');

    const values = normalizeReview(payload);
    review.title = values.normalizedTitle;
    review.comment = values.normalizedComment;
    review.rating = values.numericRating;
    review.categoryRatings = values.normalizedRatings;
    await review.save();
    return review;
  }

  static async listReceived(user) {
    const userRole = String(user.role || '').toUpperCase();
    if (userRole === ROLES.RETAILER) return [];
    const reviews = await Review.find({
      recipientId: user._id,
      recipientRole: userRole,
      userRole: ROLES.RETAILER,
      status: 'approved',
      isDeleted: false,
    })
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    const reviewerIds = reviews.map((review) => review.userId?._id).filter(Boolean);
    const profileModel = user.role === ROLES.RETAILER ? WholesalerProfile : RetailerProfile;
    const profiles = await profileModel.find({ userId: { $in: reviewerIds } })
      .select('userId businessName ownerName')
      .lean();
    const profileByUserId = new Map(profiles.map((profile) => [String(profile.userId), profile]));

    return reviews.map((review) => {
      const reviewer = review.userId;
      const profile = reviewer ? profileByUserId.get(String(reviewer._id)) : null;
      return {
        id: String(review._id),
        title: review.title,
        comment: review.comment,
        rating: review.rating,
        createdAt: review.createdAt,
        readAt: review.recipientReadAt || null,
        isRead: Boolean(review.recipientReadAt),
        reviewer: {
          id: reviewer ? String(reviewer._id) : '',
          name: profile?.businessName || profile?.ownerName || reviewer?.name || 'Business partner',
          role: review.userRole || reviewer?.role || '',
        },
      };
    });
  }

  static async listSubmitted(user) {
    const userRole = String(user.role || '').toUpperCase();
    if (userRole !== ROLES.RETAILER) {
      throw new ForbiddenError('Only retailer reviews are available');
    }

    const reviews = await Review.find({
      userId: user._id,
      userRole: ROLES.RETAILER,
      recipientRole: ROLES.WHOLESALER,
      isDeleted: false,
    })
      .populate('recipientId', 'name email role')
      .sort({ createdAt: -1 })
      .lean();
    const recipientIds = reviews.map((review) => review.recipientId?._id).filter(Boolean);
    const wholesalerProfiles = await WholesalerProfile.find({ userId: { $in: recipientIds } })
      .select('userId businessName')
      .lean();
    const wholesalerNames = new Map(wholesalerProfiles.map((profile) => [String(profile.userId), profile.businessName]));

    return reviews.map((review) => ({
      id: String(review._id),
      title: review.title,
      comment: review.comment,
      rating: review.rating,
      categoryRatings: review.categoryRatings || {},
      orderId: review.orderId ? String(review.orderId) : '',
      status: review.status,
      createdAt: review.createdAt,
      recipient: {
        id: review.recipientId?._id ? String(review.recipientId._id) : '',
        name: wholesalerNames.get(String(review.recipientId?._id)) || review.recipientId?.name || 'Wholesaler',
        role: review.recipientRole || review.recipientId?.role || '',
      },
    }));
  }

  static async markReceivedRead(user, reviewId) {
    if (!mongoose.isValidObjectId(reviewId)) throw new BadRequestError('A valid review ID is required');
    const review = await Review.findOneAndUpdate(
      {
        _id: reviewId,
        recipientId: user._id,
        recipientRole: String(user.role).toUpperCase(),
        status: 'approved',
        isDeleted: false,
      },
      { $set: { recipientReadAt: new Date() } },
      { new: true },
    ).select('_id recipientReadAt');
    if (!review) throw new ForbiddenError('Review is not available to this account');
    return { id: String(review._id), readAt: review.recipientReadAt, isRead: true };
  }

  static async getConnectedPartners(user) {
    const reviewerRole = String(user.role).toUpperCase();
    if (![ROLES.RETAILER, ROLES.WHOLESALER].includes(reviewerRole)) {
      throw new ForbiddenError('Partner list is not available for this account');
    }

    const relationshipFilter = reviewerRole === ROLES.RETAILER
      ? { retailerId: user._id, status: RELATIONSHIP_STATUS.ACTIVE }
      : { wholesalerId: user._id, status: RELATIONSHIP_STATUS.ACTIVE };
    const relationships = await WholesalerRetailerRelationship.find(relationshipFilter)
      .select(reviewerRole === ROLES.RETAILER ? 'wholesalerId' : 'retailerId')
      .lean();
    const partnerIds = relationships.map((relationship) =>
      reviewerRole === ROLES.RETAILER ? relationship.wholesalerId : relationship.retailerId
    );
    if (!partnerIds.length) return [];

    const partners = await User.find({ _id: { $in: partnerIds }, status: 'ACTIVE' })
      .select('name email role')
      .lean();
    const profileModel = reviewerRole === ROLES.RETAILER ? WholesalerProfile : RetailerProfile;
    const profiles = await profileModel.find({ userId: { $in: partnerIds } })
      .select('userId businessName ownerName')
      .lean();
    const profileByUserId = new Map(profiles.map((profile) => [String(profile.userId), profile]));

    return partners.map((partner) => ({
      id: String(partner._id),
      name: profileByUserId.get(String(partner._id))?.businessName
        || profileByUserId.get(String(partner._id))?.ownerName
        || partner.name,
      role: partner.role,
    }));
  }
}

module.exports = ReviewsService;

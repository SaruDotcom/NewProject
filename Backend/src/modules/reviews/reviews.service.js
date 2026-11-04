const mongoose = require('mongoose');
const {
  Review,
  User,
  WholesalerProfile,
  RetailerProfile,
  WholesalerRetailerRelationship,
} = require('../../models');
const { RELATIONSHIP_STATUS, ROLES } = require('../../config/constants');
const { BadRequestError, ForbiddenError } = require('../../utils/errors');

class ReviewsService {
  static async create(user, { recipientId, title = '', comment = '', rating } = {}) {
    const reviewerRole = String(user.role || '').toUpperCase();
    const recipientRole = reviewerRole === ROLES.RETAILER
      ? ROLES.WHOLESALER
      : reviewerRole === ROLES.WHOLESALER
        ? ROLES.RETAILER
        : null;

    if (!recipientRole) throw new ForbiddenError('Only retailers and wholesalers can submit partner reviews');
    if (!mongoose.isValidObjectId(recipientId)) throw new BadRequestError('A valid review recipient is required');

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

    const relationship = reviewerRole === ROLES.RETAILER
      ? await WholesalerRetailerRelationship.exists({
          retailerId: user._id,
          wholesalerId: recipientId,
          status: RELATIONSHIP_STATUS.ACTIVE,
        })
      : await WholesalerRetailerRelationship.exists({
          wholesalerId: user._id,
          retailerId: recipientId,
          status: RELATIONSHIP_STATUS.ACTIVE,
        });
    if (!relationship) throw new ForbiddenError('Reviews can only be submitted for an active business partner');

    return Review.create({
      userId: user._id,
      userRole: reviewerRole,
      recipientId,
      recipientRole,
      ...(recipientRole === ROLES.WHOLESALER ? { wholesalerId: recipientId } : {}),
      title: normalizedTitle,
      comment: normalizedComment,
      rating: numericRating,
      status: 'approved',
    });
  }

  static async listReceived(user) {
    const reviews = await Review.find({
      recipientId: user._id,
      recipientRole: String(user.role).toUpperCase(),
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
        reviewer: {
          id: reviewer ? String(reviewer._id) : '',
          name: profile?.businessName || profile?.ownerName || reviewer?.name || 'Business partner',
          role: review.userRole || reviewer?.role || '',
        },
      };
    });
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

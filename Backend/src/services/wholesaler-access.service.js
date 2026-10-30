const { User } = require('../models');
const { ROLES, USER_STATUS } = require('../config/constants');
const { ForbiddenError } = require('../utils/errors');

const WHOLESALER_UNAVAILABLE_MESSAGE = 'This wholesaler is currently unavailable.';

const assertWholesalerAvailable = async (wholesalerId) => {
  const wholesaler = await User.findOne({
    _id: wholesalerId,
    role: ROLES.WHOLESALER,
  }).select('_id status isDeleted').lean();

  if (
    !wholesaler ||
    wholesaler.isDeleted ||
    wholesaler.status === USER_STATUS.BLOCKED ||
    wholesaler.status === USER_STATUS.SUSPENDED
  ) {
    throw new ForbiddenError(WHOLESALER_UNAVAILABLE_MESSAGE, 'WHOLESALER_UNAVAILABLE');
  }

  return wholesaler;
};

module.exports = {
  assertWholesalerAvailable,
  WHOLESALER_UNAVAILABLE_MESSAGE,
};

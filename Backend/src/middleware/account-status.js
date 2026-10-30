const { ForbiddenError } = require('../utils/errors');
const { USER_STATUS } = require('../config/constants');

const accountStatus = (req, res, next) => {
  const { user } = req;
  if (user?.status === USER_STATUS.BLOCKED || user?.status === USER_STATUS.SUSPENDED) {
    return next(new ForbiddenError(`Account is ${user.status.toLowerCase()}. Please contact support.`));
  }
  return next();
};

module.exports = accountStatus;

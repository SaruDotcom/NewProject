const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('User must be authenticated before authorization'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Forbidden: Role '${req.user.role}' is not authorized to access this resource`,
          'FORBIDDEN_ROLE'
        )
      );
    }

    next();
  };
};

module.exports = authorize;

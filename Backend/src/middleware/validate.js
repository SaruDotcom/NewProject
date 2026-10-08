const { ValidationError } = require('../utils/errors');

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[source];

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const errorDetails = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
        type: detail.type,
      }));

      return next(new ValidationError('Validation error in request parameters', errorDetails));
    }

    req[source] = value;
    next();
  };
};

module.exports = validate;

const logger = require('../config/logger');
const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let errors = err.errors || [];
  const validationDetails = err.name === 'ValidationError'
    ? Object.values(err.errors || {}).map((error) => ({ field: error.path, message: error.message }))
    : Array.isArray(err.errors)
      ? err.errors.map((error) => ({ field: error.field, message: error.message }))
      : [];
  const logStatusCode = err.name === 'ValidationError' ? 422 : statusCode;
  const logCode = err.name === 'ValidationError' ? 'VALIDATION_ERROR' : code;

  // Log error
  if (logStatusCode >= 500) {
    const body = { ...(req.body || {}) };
    delete body.razorpay_signature;
    logger.error(`[${req.method}] ${req.originalUrl} - 500 Internal Error: ${err.message}`, {
      stack: err.stack,
      body,
    });
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} - ${logStatusCode} ${logCode}: ${err.message}`, {
      errors: validationDetails,
    });
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for resource identifier: ${err.value}`;
    code = 'INVALID_ID_FORMAT';
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A resource with this ${field} already exists.`;
    code = 'DUPLICATE_ENTRY';
    
    // Check for our custom partial unique index
    if (err.message && err.message.includes('unique_active_retailer_relationship')) {
      message = 'Retailer is already connected to an active wholesaler.';
      code = 'RETAILER_ALREADY_LINKED';
    }
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    errors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Handle Multer errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum allowed size (10MB).';
      code = 'FILE_TOO_LARGE';
    } else {
      message = `Upload error: ${err.message}`;
      code = 'UPLOAD_ERROR';
    }
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    code = 'TOKEN_EXPIRED';
  }

  // Security: Never leak database internals or stack traces in responses
  const response = {
    success: false,
    message,
    code,
    ...(errors.length > 0 && { errors }),
    ...(env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  };

  return res.status(statusCode).json(response);
};

module.exports = errorHandler;

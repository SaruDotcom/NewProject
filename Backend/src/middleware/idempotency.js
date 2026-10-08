const { IdempotencyKey } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

const idempotency = asyncHandler(async (req, res, next) => {
  const key = req.headers['idempotency-key'];

  // If no idempotency key is provided, proceed normally
  if (!key) {
    return next();
  }

  const userId = req.user ? req.user._id : null;

  // Check if a response is already cached for this idempotency key
  const existingRecord = await IdempotencyKey.findOne({ key, userId });

  if (existingRecord) {
    res.setHeader('X-Cache-Lookup', 'HIT');
    return res.status(existingRecord.responseStatus).json(existingRecord.responseData);
  }

  // Intercept res.json to cache response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Only save successful or validated responses (don't cache 500s)
    if (res.statusCode < 500) {
      IdempotencyKey.create({
        key,
        userId,
        requestPath: req.originalUrl,
        requestMethod: req.method,
        responseStatus: res.statusCode,
        responseData: body,
      }).catch((err) => {
        // Log silently, don't fail client request on idempotency save error
      });
    }
    return originalJson(body);
  };

  next();
});

module.exports = idempotency;

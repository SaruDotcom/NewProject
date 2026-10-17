const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const corsOptions = require('./config/cors');
const logger = require('./config/logger');
const { apiRateLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');
const { NotFoundError } = require('./utils/errors');

const app = express();

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Request logging with Morgan integrated to Winston
const morganStream = {
  write: (message) => logger.http(message.trim()),
};
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', { stream: morganStream }));

// Body parsers with safe payload limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global API rate limiting
app.use('/api', apiRateLimiter);

// Serve static uploads
const path = require('path');
const env = require('./config/env');
app.use('/uploads/products', express.static(path.join(env.UPLOAD_PATH, 'products')));

// Serve MongoDB GridFS product images
app.get('/product-images/:id', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const { ObjectId } = mongoose.Types;
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).send('Invalid image ID');
    }
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'productImages' });
    const file = await mongoose.connection.db.collection('productImages.files').findOne({ _id: new ObjectId(req.params.id) });
    if (!file) return res.status(404).send('Image not found');
    res.setHeader('Content-Type', file.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    bucket.openDownloadStream(new ObjectId(req.params.id)).pipe(res);
  } catch (err) {
    res.status(500).send('Error streaming product image');
  }
});


// Top-level Health check endpoint
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    success: true,
    status: 'healthy',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes: both /api/v1 (primary standard) and /api (frontend backward-compatibility)
app.use('/api/v1', routes);
app.use('/api', routes);

// 404 Handler for undefined routes
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`, 'ROUTE_NOT_FOUND'));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;

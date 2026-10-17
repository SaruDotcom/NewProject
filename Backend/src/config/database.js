const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

let isConnected = false;

const connectDB = async (uri = env.MONGO_URI) => {
  if (isConnected) {
    return mongoose.connection;
  }

  const primaryUri = uri || 'mongodb://127.0.0.1:27017/b2b-wholesale';
  const fallbackUri = 'mongodb://127.0.0.1:27017/b2b-wholesale';

  try {
    const conn = await mongoose.connect(primaryUri, { autoIndex: true, serverSelectionTimeoutMS: 5000 });
    isConnected = true;
    logger.info(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (error) {
    const isRemote = primaryUri.startsWith('mongodb+srv://') || (!primaryUri.includes('127.0.0.1') && !primaryUri.includes('localhost'));
    if (isRemote) {
      logger.warn(`Primary remote MongoDB connection failed (${error.message}). Attempting fallback to local MongoDB (${fallbackUri})...`);
      try {
        const fallbackConn = await mongoose.connect(fallbackUri, { autoIndex: true, serverSelectionTimeoutMS: 5000 });
        isConnected = true;
        logger.info(`Fallback MongoDB Connected: ${fallbackConn.connection.host}/${fallbackConn.connection.name}`);
        return fallbackConn.connection;
      } catch (fallbackError) {
        logger.error(`Fallback MongoDB Connection Error: ${fallbackError.message}`);
      }
    }

    if (env.NODE_ENV !== 'test') {
      logger.error(`MongoDB Connection Error: ${error.message}`);
    }

    throw error;
  }
};

const disconnectDB = async () => {
  if (!isConnected) return;
  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB Disconnected successfully.');
  } catch (error) {
    logger.error(`MongoDB Disconnect Error: ${error.message}`);
  }
};

module.exports = {
  connectDB,
  disconnectDB,
};

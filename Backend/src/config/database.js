const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

let isConnected = false;

const connectDB = async (uri = env.MONGO_URI) => {
  if (isConnected) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(uri, { autoIndex: true });
    isConnected = true;
    logger.info(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (error) {
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

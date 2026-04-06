const mongoose = require('mongoose');
const config = require('./index');

const MAX_RETRIES = 5;
const RETRY_DELAY = 3000;

const connectDB = async (retries = 0) => {
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error(`MongoDB connection error (attempt ${retries + 1}/${MAX_RETRIES}):`, error.message);
    if (retries < MAX_RETRIES - 1) {
      console.log(`Retrying in ${RETRY_DELAY / 1000}s...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return connectDB(retries + 1);
    }
    console.error('MongoDB connection failed after all retries');
    throw error;
  }
};

module.exports = connectDB;

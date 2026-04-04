const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  port: process.env.PORT || 5001,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restaurant_pos',
  cloudMongoUri: process.env.CLOUD_MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  backupDir: process.env.BACKUP_DIR || './backups',
  syncEnabled: process.env.SYNC_ENABLED === 'true',
  syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS, 10) || 30000,
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  notificationEmail: process.env.NOTIFICATION_EMAIL,
};

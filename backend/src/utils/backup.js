const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const createBackup = () => {
  return new Promise((resolve, reject) => {
    const backupDir = path.resolve(config.backupDir);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);

    const cmd = `mongodump --uri="${config.mongoUri}" --out="${backupPath}"`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('Backup failed:', error.message);
        reject(error);
        return;
      }
      console.log('Backup created at:', backupPath);
      resolve(backupPath);
    });
  });
};

const restoreBackup = (backupPath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(backupPath)) {
      reject(new Error('Backup path does not exist'));
      return;
    }

    const cmd = `mongorestore --uri="${config.mongoUri}" --drop "${backupPath}"`;

    exec(cmd, (error) => {
      if (error) {
        console.error('Restore failed:', error.message);
        reject(error);
        return;
      }
      console.log('Database restored from:', backupPath);
      resolve(true);
    });
  });
};

// Run directly
if (require.main === module) {
  createBackup()
    .then((p) => { console.log('Backup complete:', p); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { createBackup, restoreBackup };

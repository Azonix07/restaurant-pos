const { createBackup } = require('../utils/backup');
const AlertLog = require('../models/AlertLog');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let backupInterval = null;
let cleanupInterval = null;

const BACKUP_INTERVAL_MS = 4 * 60 * 60 * 1000; // Every 4 hours
const MAX_BACKUPS = 10;                          // Keep last 10 backups
const BACKUP_DIR = path.resolve(config.backupDir);

const runAutoBackup = async () => {
  try {
    console.log('[AUTO-BACKUP] Starting scheduled backup...');
    const backupPath = await createBackup();
    console.log('[AUTO-BACKUP] Backup completed:', backupPath);

    await AlertLog.create({
      type: 'auto_backup',
      severity: 'info',
      title: 'Auto Backup Completed',
      message: `Backup saved to: ${backupPath}`,
    });
  } catch (err) {
    console.error('[AUTO-BACKUP] Failed:', err.message);
    await AlertLog.create({
      type: 'auto_backup_failed',
      severity: 'critical',
      title: 'Auto Backup FAILED',
      message: `Backup failed: ${err.message}`,
    }).catch(() => {});
  }
};

const cleanOldBackups = async () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const entries = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (entries.length > MAX_BACKUPS) {
      const toDelete = entries.slice(MAX_BACKUPS);
      for (const entry of toDelete) {
        const fullPath = path.join(BACKUP_DIR, entry.name);
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log('[AUTO-BACKUP] Cleaned old backup:', entry.name);
      }
    }
  } catch (err) {
    console.error('[AUTO-BACKUP] Cleanup error:', err.message);
  }
};

exports.startAutoBackup = () => {
  // Run first backup 5 minutes after startup
  setTimeout(runAutoBackup, 5 * 60 * 1000);

  // Schedule periodic backups
  backupInterval = setInterval(runAutoBackup, BACKUP_INTERVAL_MS);

  // Clean old backups every 12 hours
  cleanupInterval = setInterval(cleanOldBackups, 12 * 60 * 60 * 1000);
  cleanOldBackups(); // Run cleanup immediately

  console.log(`[AUTO-BACKUP] Scheduled every ${BACKUP_INTERVAL_MS / 3600000}h, keeping last ${MAX_BACKUPS} backups`);
};

exports.stopAutoBackup = () => {
  if (backupInterval) clearInterval(backupInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);
};

exports.runNow = runAutoBackup;

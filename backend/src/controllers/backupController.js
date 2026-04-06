const path = require('path');
const fs = require('fs');
const { createBackup, restoreBackup } = require('../utils/backup');
const AuditLog = require('../models/AuditLog');
const config = require('../config');

// Manual backup trigger
exports.createBackup = async (req, res, next) => {
  try {
    const backupPath = await createBackup();

    await AuditLog.create({
      action: 'backup',
      module: 'system',
      description: `Manual backup created at ${backupPath}`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({ message: 'Backup created successfully', path: backupPath });
  } catch (error) {
    next(error);
  }
};

// List available backups
exports.listBackups = async (req, res, next) => {
  try {
    const backupDir = path.resolve(config.backupDir);
    if (!fs.existsSync(backupDir)) {
      return res.json({ backups: [] });
    }

    const entries = fs.readdirSync(backupDir, { withFileTypes: true });
    const backups = entries
      .filter(e => e.isDirectory() && e.name.startsWith('backup-'))
      .map(e => {
        const fullPath = path.join(backupDir, e.name);
        const stat = fs.statSync(fullPath);
        return {
          name: e.name,
          path: fullPath,
          createdAt: stat.birthtime,
          size: getDirSize(fullPath),
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ backups, count: backups.length });
  } catch (error) {
    next(error);
  }
};

// Restore from backup (admin only)
exports.restoreFromBackup = async (req, res, next) => {
  try {
    const { backupName } = req.body;
    if (!backupName) return res.status(400).json({ message: 'Backup name is required' });

    const backupDir = path.resolve(config.backupDir);
    const backupPath = path.join(backupDir, backupName);

    // Prevent path traversal
    if (!backupPath.startsWith(backupDir)) {
      return res.status(400).json({ message: 'Invalid backup name' });
    }

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ message: 'Backup not found' });
    }

    await restoreBackup(backupPath);

    await AuditLog.create({
      action: 'restore',
      module: 'system',
      description: `Database restored from ${backupName}`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({ message: 'Database restored successfully' });
  } catch (error) {
    next(error);
  }
};

// Delete old backups (keep last N)
exports.cleanupBackups = async (req, res, next) => {
  try {
    const keepCount = parseInt(req.query.keep, 10) || 7;
    const backupDir = path.resolve(config.backupDir);
    if (!fs.existsSync(backupDir)) {
      return res.json({ deleted: 0 });
    }

    const entries = fs.readdirSync(backupDir, { withFileTypes: true });
    const backups = entries
      .filter(e => e.isDirectory() && e.name.startsWith('backup-'))
      .map(e => ({
        name: e.name,
        path: path.join(backupDir, e.name),
        time: fs.statSync(path.join(backupDir, e.name)).birthtime,
      }))
      .sort((a, b) => b.time - a.time);

    const toDelete = backups.slice(keepCount);
    for (const b of toDelete) {
      fs.rmSync(b.path, { recursive: true, force: true });
    }

    res.json({ deleted: toDelete.length, remaining: keepCount });
  } catch (error) {
    next(error);
  }
};

// Auto-backup (called from counter close)
exports.triggerAutoBackup = async () => {
  try {
    const backupPath = await createBackup();
    console.log('[Auto-Backup] Created at:', backupPath);
    return backupPath;
  } catch (err) {
    console.error('[Auto-Backup] Failed:', err.message);
    return null;
  }
};

function getDirSize(dirPath) {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        size += fs.statSync(fullPath).size;
      } else if (entry.isDirectory()) {
        size += getDirSize(fullPath);
      }
    }
  } catch { /* ignore */ }
  return size;
}

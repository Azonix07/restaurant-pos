import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiDownloadCloud, FiUploadCloud, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Backup.css';

const Backup = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [confirmCleanup, setConfirmCleanup] = useState(false);

  const fetchBackups = async () => {
    try {
      const res = await api.get('/backup/list');
      setBackups(res.data.backups || []);
    } catch (err) {
      toast.error('Failed to load backups');
    }
  };

  useEffect(() => { fetchBackups(); }, []);

  const createBackup = async () => {
    setLoading(true);
    try {
      await api.post('/backup/create');
      toast.success('Backup created successfully');
      fetchBackups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Backup creation failed');
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async (backupName) => {
    setLoading(true);
    try {
      await api.post('/backup/restore', { backupName });
      toast.success('Backup restored successfully');
      setConfirmRestore(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restore failed');
    } finally {
      setLoading(false);
    }
  };

  const cleanupBackups = async () => {
    setLoading(true);
    try {
      const res = await api.delete('/backup/cleanup?keep=7');
      toast.success(res.data.message || 'Old backups cleaned up');
      setConfirmCleanup(false);
      fetchBackups();
    } catch (err) {
      toast.error('Cleanup failed');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="backup-page">
      <div className="page-header">
        <h1><FiDownloadCloud style={{ marginRight: 8 }} />Backup & Restore</h1>
        <div className="flex gap-8">
          <button className="btn btn-primary" onClick={createBackup} disabled={loading}><FiDownloadCloud /> Create Backup</button>
          <button className="btn btn-danger" onClick={() => setConfirmCleanup(true)} disabled={loading}><FiTrash2 /> Cleanup Old</button>
        </div>
      </div>

      <div className="card">
        <table className="bk-table">
          <thead>
            <tr><th>Name</th><th>Date</th><th>Size</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {backups.map(b => (
              <tr key={b.name}>
                <td>{b.name}</td>
                <td>{new Date(b.date || b.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td>{formatSize(b.size)}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => setConfirmRestore(b.name)} disabled={loading}><FiUploadCloud /> Restore</button>
                </td>
              </tr>
            ))}
            {backups.length === 0 && (
              <tr><td colSpan="4" className="text-center text-secondary" style={{ padding: 40 }}>No backups found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmRestore && (
        <div className="bk-modal-overlay" onClick={() => setConfirmRestore(null)}>
          <div className="bk-modal" onClick={e => e.stopPropagation()}>
            <h3 className="mb-12">Confirm Restore</h3>
            <p className="text-secondary mb-16">Are you sure you want to restore <strong>{confirmRestore}</strong>? This will overwrite current data.</p>
            <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmRestore(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => restoreBackup(confirmRestore)} disabled={loading}>{loading ? 'Restoring...' : 'Restore'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmCleanup && (
        <div className="bk-modal-overlay" onClick={() => setConfirmCleanup(false)}>
          <div className="bk-modal" onClick={e => e.stopPropagation()}>
            <h3 className="mb-12">Cleanup Backups</h3>
            <p className="text-secondary mb-16">This will delete all backups except the 7 most recent. Continue?</p>
            <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmCleanup(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={cleanupBackups} disabled={loading}>{loading ? 'Cleaning...' : 'Cleanup'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Backup;

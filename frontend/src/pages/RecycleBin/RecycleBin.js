import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiRefreshCw, FiTrash2, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';

const RecycleBin = () => {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');

  const fetchItems = async () => {
    try {
      const params = filter ? `?model=${filter}` : '';
      const res = await api.get(`/recycle-bin${params}`);
      setItems(res.data.items || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchItems(); }, [filter]);

  const restore = async (id) => {
    try { await api.post(`/recycle-bin/${id}/restore`); toast.success('Item restored'); fetchItems(); } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const permanentDelete = async (id) => {
    if (!window.confirm('Permanently delete this item? This cannot be undone.')) return;
    try { await api.delete(`/recycle-bin/${id}`); toast.success('Permanently deleted'); fetchItems(); } catch (err) { toast.error('Failed'); }
  };

  const emptyBin = async () => {
    if (!window.confirm('Empty the entire recycle bin? This cannot be undone.')) return;
    try { const res = await api.delete('/recycle-bin'); toast.success(res.data.message); fetchItems(); } catch (err) { toast.error('Failed'); }
  };

  const models = [...new Set(items.map(i => i.originalModel))];

  return (
    <div>
      <div className="page-header">
        <h1>♻️ Recycle Bin</h1>
        <div className="flex gap-8">
          <select className="input" style={{ width: 'auto' }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All Types</option>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {items.length > 0 && <button className="btn btn-danger" onClick={emptyBin}>Empty Bin</button>}
        </div>
      </div>

      <div className="card">
        {items.length === 0 ? <p className="text-secondary text-center">Recycle bin is empty</p> : (
          <table className="data-table">
            <thead><tr><th>Type</th><th>Name / Info</th><th>Deleted By</th><th>Deleted At</th><th>Expires</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item._id}>
                  <td><span className="badge badge-preparing">{item.originalModel}</span></td>
                  <td>{item.data?.name || item.data?.invoiceNumber || item.data?.title || item.originalId}</td>
                  <td>{item.deletedByName || '-'}</td>
                  <td>{new Date(item.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>{new Date(item.expiresAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <div className="flex gap-4">
                      <button className="btn btn-success btn-sm" onClick={() => restore(item._id)} title="Restore"><FiRefreshCw /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => permanentDelete(item._id)} title="Delete Forever"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RecycleBin;

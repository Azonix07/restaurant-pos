import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiPlus, FiX, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';

const FixedAssets = () => {
  const [assets, setAssets] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', category: 'Equipment', purchaseDate: new Date().toISOString().split('T')[0],
    purchasePrice: 0, depreciationRate: 10, depreciationMethod: 'straight_line',
    salvageValue: 0, location: '', serialNumber: '', notes: '',
  });

  const fetchAssets = async () => {
    try { const res = await api.get('/fixed-assets'); setAssets(res.data.assets || []); } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchAssets(); }, []);

  const addAsset = async (e) => {
    e.preventDefault();
    try {
      await api.post('/fixed-assets', { ...form, purchasePrice: Number(form.purchasePrice), salvageValue: Number(form.salvageValue), depreciationRate: Number(form.depreciationRate) });
      toast.success('Asset added');
      setShowAdd(false);
      fetchAssets();
    } catch (err) { toast.error('Failed'); }
  };

  const disposeAsset = async (id) => {
    const amt = window.prompt('Disposal amount (₹):');
    if (amt === null) return;
    try {
      await api.post(`/fixed-assets/${id}/dispose`, { status: 'disposed', disposalAmount: Number(amt) });
      toast.success('Asset disposed');
      fetchAssets();
    } catch (err) { toast.error('Failed'); }
  };

  const deleteAsset = async (id) => {
    if (!window.confirm('Move to recycle bin?')) return;
    try { await api.delete(`/fixed-assets/${id}`); toast.success('Moved to recycle bin'); fetchAssets(); } catch (err) { toast.error('Failed'); }
  };

  const totalValue = assets.reduce((s, a) => s + (a.currentValue || 0), 0);
  const totalPurchase = assets.reduce((s, a) => s + a.purchasePrice, 0);
  const totalDepreciation = assets.reduce((s, a) => s + (a.accumulatedDepreciation || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Fixed Assets</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><FiPlus /> Add Asset</button>
      </div>

      <div className="grid-4 mb-24">
        <div className="stat-card"><div className="stat-label">Total Assets</div><div className="stat-value">{assets.length}</div></div>
        <div className="stat-card"><div className="stat-label">Purchase Value</div><div className="stat-value">₹{totalPurchase.toLocaleString('en-IN')}</div></div>
        <div className="stat-card"><div className="stat-label">Current Value</div><div className="stat-value">₹{Math.round(totalValue).toLocaleString('en-IN')}</div></div>
        <div className="stat-card"><div className="stat-label">Total Depreciation</div><div className="stat-value" style={{ color: 'var(--danger)' }}>₹{Math.round(totalDepreciation).toLocaleString('en-IN')}</div></div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Category</th><th>Purchase Date</th><th>Purchase Price</th><th>Current Value</th><th>Depreciation</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {assets.map(a => (
              <tr key={a._id}>
                <td><strong>{a.name}</strong>{a.serialNumber && <span className="text-secondary" style={{ fontSize: 11 }}><br />S/N: {a.serialNumber}</span>}</td>
                <td>{a.category}</td>
                <td>{new Date(a.purchaseDate).toLocaleDateString('en-IN')}</td>
                <td>₹{a.purchasePrice?.toLocaleString('en-IN')}</td>
                <td>₹{Math.round(a.currentValue || 0).toLocaleString('en-IN')}</td>
                <td style={{ color: 'var(--danger)' }}>₹{Math.round(a.accumulatedDepreciation || 0).toLocaleString('en-IN')}</td>
                <td><span className={`badge ${a.status === 'active' ? 'badge-completed' : 'badge-cancelled'}`} style={{ textTransform: 'capitalize' }}>{a.status}</span></td>
                <td>
                  <div className="flex gap-4">
                    {a.status === 'active' && <button className="btn btn-warning btn-sm" onClick={() => disposeAsset(a._id)}>Dispose</button>}
                    <button className="btn btn-danger btn-sm" onClick={() => deleteAsset(a._id)}><FiTrash2 /></button>
                  </div>
                </td>
              </tr>
            ))}
            {assets.length === 0 && <tr><td colSpan="8" className="text-center text-secondary">No fixed assets</td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-16"><h2>Add Fixed Asset</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}><FiX /></button></div>
            <form onSubmit={addAsset}>
              <div className="input-group"><label>Name *</label><input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="input-group"><label>Category</label>
                <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {['Equipment', 'Furniture', 'Vehicle', 'Building', 'Electronics', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="input-group"><label>Purchase Date</label><input className="input" type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} /></div>
              <div className="input-group"><label>Purchase Price (₹)</label><input className="input" type="number" min="0" required value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: e.target.value })} /></div>
              <div className="input-group"><label>Depreciation Rate (%/year)</label><input className="input" type="number" value={form.depreciationRate} onChange={e => setForm({ ...form, depreciationRate: e.target.value })} /></div>
              <div className="input-group"><label>Method</label>
                <select className="input" value={form.depreciationMethod} onChange={e => setForm({ ...form, depreciationMethod: e.target.value })}>
                  <option value="straight_line">Straight Line</option><option value="written_down">Written Down Value</option>
                </select>
              </div>
              <div className="input-group"><label>Salvage Value (₹)</label><input className="input" type="number" min="0" value={form.salvageValue} onChange={e => setForm({ ...form, salvageValue: e.target.value })} /></div>
              <div className="input-group"><label>Serial Number</label><input className="input" value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} /></div>
              <div className="input-group"><label>Location</label><input className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Add Asset</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedAssets;

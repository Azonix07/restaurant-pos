import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiPlus, FiCheck, FiX, FiAlertTriangle, FiBarChart2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Wastage.css';

const Wastage = () => {
  const [activeTab, setActiveTab] = useState('entries');
  const [entries, setEntries] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rawMaterial: '', itemName: '', quantity: 0, unit: 'kg', reason: 'expired', description: '', supervisorPin: '' });

  const fetchEntries = useCallback(async () => {
    try { const res = await api.get('/wastage'); setEntries(res.data.entries); } catch (e) { toast.error('Load failed'); }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try { const res = await api.get('/wastage/analytics'); setAnalytics(res.data); } catch (e) { console.error(e); }
  }, []);

  const fetchMaterials = useCallback(async () => {
    try { const res = await api.get('/stock/materials'); setMaterials(res.data.materials); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchEntries(); fetchMaterials(); }, [fetchEntries, fetchMaterials]);
  useEffect(() => { if (activeTab === 'analytics') fetchAnalytics(); }, [activeTab, fetchAnalytics]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supervisorPin) { toast.warning('Supervisor PIN is required'); return; }
    try {
      await api.post('/wastage', form);
      toast.success('Wastage reported');
      setShowForm(false);
      setForm({ rawMaterial: '', itemName: '', quantity: 0, unit: 'kg', reason: 'expired', description: '', supervisorPin: '' });
      fetchEntries();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleApprove = async (id) => {
    try { await api.patch(`/wastage/${id}/approve`); toast.success('Approved'); fetchEntries(); } catch (e) { toast.error('Approve failed'); }
  };

  const handleReject = async (id) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try { await api.patch(`/wastage/${id}/reject`, { reason }); toast.success('Rejected'); fetchEntries(); } catch (e) { toast.error('Reject failed'); }
  };

  return (
    <div>
      <div className="page-header"><h1><FiAlertTriangle /> Wastage Control</h1></div>

      <div className="report-tabs mb-24">
        <button className={`btn ${activeTab === 'entries' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('entries')}>Entries</button>
        <button className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('analytics')}><FiBarChart2 /> Analytics</button>
      </div>

      {activeTab === 'entries' && (
        <>
          <button className="btn btn-primary mb-16" onClick={() => setShowForm(!showForm)}><FiPlus /> Report Wastage</button>

          {showForm && (
            <div className="card mb-16">
              <form onSubmit={handleSubmit}>
                <div className="grid-3 mb-16">
                  <div className="input-group"><label>Raw Material</label>
                    <select className="input" value={form.rawMaterial} onChange={e => {
                      const m = materials.find(m => m._id === e.target.value);
                      setForm({ ...form, rawMaterial: e.target.value, itemName: m?.name || '', unit: m?.unit || 'kg' });
                    }}>
                      <option value="">Select...</option>
                      {materials.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="input-group"><label>Item Name *</label><input className="input" required value={form.itemName} onChange={e => setForm({ ...form, itemName: e.target.value })} /></div>
                  <div className="input-group"><label>Quantity *</label><input className="input" type="number" step="0.01" required value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
                  <div className="input-group"><label>Unit</label><input className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
                  <div className="input-group"><label>Reason *</label>
                    <select className="input" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}>
                      <option value="expired">Expired</option><option value="damaged">Damaged</option><option value="spillage">Spillage</option>
                      <option value="overproduction">Overproduction</option><option value="returned">Returned by customer</option>
                      <option value="quality_issue">Quality Issue</option><option value="other">Other</option>
                    </select>
                  </div>
                  <div className="input-group"><label>Supervisor PIN *</label><input className="input" type="password" required value={form.supervisorPin} onChange={e => setForm({ ...form, supervisorPin: e.target.value })} /></div>
                </div>
                <div className="input-group mb-16"><label>Description</label><textarea className="input" rows="2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div className="flex gap-8"><button type="submit" className="btn btn-primary">Submit</button><button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button></div>
              </form>
            </div>
          )}

          <table className="table">
            <thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Reason</th><th>Cost</th><th>Status</th><th>Reported By</th><th>Actions</th></tr></thead>
            <tbody>
              {entries.map(e => (
                <tr key={e._id}>
                  <td>{new Date(e.createdAt).toLocaleDateString()}</td>
                  <td>{e.itemName}</td>
                  <td>{e.quantity} {e.unit}</td>
                  <td><span className="badge badge-secondary">{e.reason}</span></td>
                  <td>₹{e.estimatedCost?.toFixed(2)}</td>
                  <td><span className={`badge badge-${e.approvalStatus === 'approved' ? 'success' : e.approvalStatus === 'rejected' ? 'danger' : 'warning'}`}>{e.approvalStatus}</span></td>
                  <td>{e.reportedBy?.name}</td>
                  <td>
                    {e.approvalStatus === 'pending' && (
                      <div className="flex gap-4">
                        <button className="btn btn-sm btn-success" onClick={() => handleApprove(e._id)}><FiCheck /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleReject(e._id)}><FiX /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {activeTab === 'analytics' && analytics && (
        <div>
          <div className="grid-4 mb-24">
            <div className="stat-card"><div className="stat-label">Total Wastage</div><div className="stat-value">₹{analytics.totalWastage?.toLocaleString()}</div></div>
            <div className="stat-card"><div className="stat-label">Total Sales</div><div className="stat-value">₹{analytics.totalSales?.toLocaleString()}</div></div>
            <div className="stat-card"><div className="stat-label">Wastage %</div><div className="stat-value" style={{ color: analytics.wastagePercent > 5 ? 'var(--danger)' : 'var(--success)' }}>{analytics.wastagePercent}%</div></div>
            <div className="stat-card"><div className="stat-label">Threshold</div><div className="stat-value" style={{ color: analytics.thresholdExceeded ? 'var(--danger)' : 'var(--success)' }}>{analytics.thresholdExceeded ? 'EXCEEDED!' : 'OK (< 5%)'}</div></div>
          </div>

          {analytics.thresholdExceeded && (
            <div className="alert-item severity-critical mb-16">
              <FiAlertTriangle /> Wastage percentage ({analytics.wastagePercent}%) exceeds the 5% threshold!
            </div>
          )}

          <div className="card">
            <h3 className="mb-16">Wastage by Reason</h3>
            <table className="table">
              <thead><tr><th>Reason</th><th>Count</th><th>Total Cost</th></tr></thead>
              <tbody>
                {analytics.byReason?.map(r => (
                  <tr key={r._id}><td>{r._id}</td><td>{r.count}</td><td>₹{r.totalCost?.toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wastage;

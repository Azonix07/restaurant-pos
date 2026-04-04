import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiPlus, FiX, FiPlay, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Production.css';

const Production = () => {
  const [batches, setBatches] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ section: 'bakery', items: [], notes: '' });
  const [newItem, setNewItem] = useState({ menuItem: '', plannedQuantity: 1 });

  const fetchBatches = async () => {
    try {
      const res = await api.get('/production');
      setBatches(res.data.productions || []);
    } catch (err) { console.error(err); }
  };

  const fetchMenu = async () => {
    try {
      const res = await api.get('/menu');
      setMenuItems(res.data.items || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchBatches(); fetchMenu(); }, []);

  const addItemToForm = () => {
    if (!newItem.menuItem) return;
    const mi = menuItems.find(m => m._id === newItem.menuItem);
    if (!mi) return;
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { menuItem: mi._id, name: mi.name, plannedQuantity: parseInt(newItem.plannedQuantity, 10) || 1 }],
    }));
    setNewItem({ menuItem: '', plannedQuantity: 1 });
  };

  const removeItemFromForm = (idx) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) return toast.error('Add at least one item');
    try {
      await api.post('/production', form);
      toast.success('Production batch created');
      setShowCreate(false);
      setForm({ section: 'bakery', items: [], notes: '' });
      fetchBatches();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const startBatch = async (id) => {
    try {
      await api.post(`/production/${id}/start`);
      toast.success('Production started — materials deducted');
      fetchBatches();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const completeBatch = async (id) => {
    try {
      await api.post(`/production/${id}/complete`, {});
      toast.success('Production completed');
      fetchBatches();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const statusColors = { planned: '#3b82f6', in_progress: '#f59e0b', completed: '#10b981', cancelled: '#ef4444' };

  return (
    <div className="production-page">
      <div className="page-header">
        <h1>Production</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><FiPlus /> New Batch</button>
      </div>

      {batches.length === 0 ? (
        <div className="card text-center" style={{ padding: 60 }}><p className="text-secondary">No production batches yet</p></div>
      ) : batches.map(b => (
        <div key={b._id} className="batch-card">
          <div className="batch-header">
            <div>
              <strong>{b.batchNumber}</strong>
              <span className={`section-tag ${b.section}`} style={{ marginLeft: 8 }}>{b.section}</span>
            </div>
            <div className="flex gap-8" style={{ alignItems: 'center' }}>
              <span className="badge" style={{ background: statusColors[b.status], color: '#fff' }}>{b.status?.replace('_', ' ')}</span>
              {b.status === 'planned' && <button className="btn btn-sm btn-warning" onClick={() => startBatch(b._id)}><FiPlay /> Start</button>}
              {b.status === 'in_progress' && <button className="btn btn-sm btn-success" onClick={() => completeBatch(b._id)}><FiCheckCircle /> Complete</button>}
            </div>
          </div>
          <div className="batch-items">
            {b.items?.map((item, i) => (
              <div key={i} className="batch-item">
                <span>{item.name}</span>
                <span>Planned: {item.plannedQuantity}{item.actualQuantity ? ` · Actual: ${item.actualQuantity}` : ''}</span>
              </div>
            ))}
          </div>
          {b.totalCost > 0 && <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-secondary)' }}>Material cost: ₹{b.totalCost?.toFixed(2)}</div>}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Created by {b.createdBy?.name} · {new Date(b.createdAt).toLocaleString('en-IN')}
          </div>
        </div>
      ))}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="flex-between mb-16"><h2>New Production Batch</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}><FiX /></button></div>
            <form onSubmit={handleCreate}>
              <div className="input-group"><label>Kitchen Section</label>
                <select className="input" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })}>
                  <option value="bakery">Bakery</option><option value="kitchen">Kitchen</option><option value="bar">Bar</option><option value="desserts">Desserts</option>
                </select>
              </div>
              <div className="input-group"><label>Add Items</label>
                <div className="flex gap-8">
                  <select className="input" value={newItem.menuItem} onChange={e => setNewItem({ ...newItem, menuItem: e.target.value })} style={{ flex: 1 }}>
                    <option value="">Select item...</option>
                    {menuItems.map(mi => <option key={mi._id} value={mi._id}>{mi.name} ({mi.category})</option>)}
                  </select>
                  <input className="input" type="number" min="1" value={newItem.plannedQuantity} onChange={e => setNewItem({ ...newItem, plannedQuantity: e.target.value })} style={{ width: 80 }} />
                  <button type="button" className="btn btn-secondary" onClick={addItemToForm}>Add</button>
                </div>
              </div>
              {form.items.length > 0 && (
                <div className="mb-16">
                  {form.items.map((it, i) => (
                    <div key={i} className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>{it.name} × {it.plannedQuantity}</span>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItemFromForm(i)}><FiX /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="input-group"><label>Notes</label><textarea className="input" rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Batch</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Production;

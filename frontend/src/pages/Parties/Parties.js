import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiPlus, FiX, FiTrash2, FiEdit2, FiSend, FiUpload, FiAlertCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Parties.css';

const Parties = () => {
  const [parties, setParties] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editParty, setEditParty] = useState(null);
  const [showPricing, setShowPricing] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [importText, setImportText] = useState('');
  const [form, setForm] = useState({
    name: '', type: 'customer', phone: '', email: '', gstin: '', pan: '',
    creditLimit: 0, paymentTermDays: 30, notes: '',
    billingAddress: { line1: '', city: '', state: '', pincode: '' },
  });

  const fetchParties = async () => {
    try {
      const params = activeTab !== 'all' ? `?type=${activeTab}` : '';
      const res = await api.get(`/parties${params}`);
      setParties(res.data.parties || []);
    } catch (err) { console.error(err); }
  };

  const fetchMenu = async () => {
    try {
      const res = await api.get('/menu');
      setMenuItems(res.data.items || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchParties(); }, [activeTab]);
  useEffect(() => { fetchMenu(); }, []);

  const resetForm = () => setForm({
    name: '', type: 'customer', phone: '', email: '', gstin: '', pan: '',
    creditLimit: 0, paymentTermDays: 30, notes: '',
    billingAddress: { line1: '', city: '', state: '', pincode: '' },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editParty) {
        await api.put(`/parties/${editParty._id}`, form);
        toast.success('Party updated');
      } else {
        await api.post('/parties', form);
        toast.success('Party created');
      }
      setShowAdd(false);
      setEditParty(null);
      resetForm();
      fetchParties();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleEdit = (party) => {
    setEditParty(party);
    setForm({
      name: party.name, type: party.type, phone: party.phone || '', email: party.email || '',
      gstin: party.gstin || '', pan: party.pan || '', creditLimit: party.creditLimit || 0,
      paymentTermDays: party.paymentTermDays || 30, notes: party.notes || '',
      billingAddress: party.billingAddress || { line1: '', city: '', state: '', pincode: '' },
    });
    setShowAdd(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move to recycle bin?')) return;
    try {
      await api.delete(`/parties/${id}`);
      toast.success('Party moved to recycle bin');
      fetchParties();
    } catch (err) { toast.error('Failed'); }
  };

  const sendReminder = async (id) => {
    try {
      const res = await api.post(`/parties/${id}/reminder`);
      toast.success(res.data.message);
    } catch (err) { toast.error('Failed to send reminder'); }
  };

  const handleImport = async () => {
    try {
      const lines = importText.trim().split('\n').filter(l => l.trim());
      const parties = lines.map(line => {
        const [name, phone, email, type, gstin] = line.split(',').map(s => s.trim());
        return { name, phone, email, type: type || 'customer', gstin };
      });
      const res = await api.post('/parties/import', { parties });
      toast.success(`Imported: ${res.data.results.created} created, ${res.data.results.skipped} skipped`);
      setShowImport(false);
      setImportText('');
      fetchParties();
    } catch (err) { toast.error('Import failed'); }
  };

  const savePricing = async (partyId, pricing) => {
    try {
      await api.put(`/parties/${partyId}/pricing`, { customPricing: pricing });
      toast.success('Custom pricing saved');
      setShowPricing(null);
      fetchParties();
    } catch (err) { toast.error('Failed'); }
  };

  const overdueParties = parties.filter(p => p.currentBalance > 0);

  return (
    <div>
      <div className="page-header">
        <h1>Party Management</h1>
        <div className="flex gap-8">
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}><FiUpload /> Import</button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setEditParty(null); setShowAdd(true); }}><FiPlus /> Add Party</button>
        </div>
      </div>

      <div className="report-tabs mb-24">
        {[{ id: 'all', label: 'All' }, { id: 'customer', label: 'Customers' }, { id: 'supplier', label: 'Suppliers' }, { id: 'overdue', label: `Overdue (${overdueParties.length})` }].map(tab => (
          <button key={tab.id} className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overdue' && (
        <div className="card mb-24" style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)' }}>
          <div className="flex gap-8" style={{ alignItems: 'center' }}>
            <FiAlertCircle style={{ color: 'var(--danger)' }} />
            <strong>Total Outstanding: ₹{overdueParties.reduce((s, p) => s + p.currentBalance, 0).toLocaleString('en-IN')}</strong>
          </div>
        </div>
      )}

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Type</th><th>Phone</th><th>GSTIN</th>
              <th>Credit Limit</th><th>Balance</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(activeTab === 'overdue' ? overdueParties : parties).map(party => (
              <tr key={party._id}>
                <td><strong>{party.name}</strong><br /><span className="text-secondary" style={{ fontSize: 12 }}>{party.email}</span></td>
                <td style={{ textTransform: 'capitalize' }}>{party.type}</td>
                <td>{party.phone || '-'}</td>
                <td>{party.gstin || '-'}</td>
                <td>₹{(party.creditLimit || 0).toLocaleString('en-IN')}</td>
                <td style={{ color: party.currentBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  ₹{(party.currentBalance || 0).toLocaleString('en-IN')}
                </td>
                <td>
                  <div className="flex gap-4">
                    <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(party)}><FiEdit2 /></button>
                    {party.currentBalance > 0 && (
                      <button className="btn btn-warning btn-sm" onClick={() => sendReminder(party._id)} title="Send Reminder"><FiSend /></button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowPricing(party)} title="Custom Pricing">₹</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(party._id)}><FiTrash2 /></button>
                  </div>
                </td>
              </tr>
            ))}
            {parties.length === 0 && <tr><td colSpan="7" className="text-center text-secondary">No parties found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => { setShowAdd(false); setEditParty(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="flex-between mb-16">
              <h2>{editParty ? 'Edit Party' : 'Add Party'}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowAdd(false); setEditParty(null); }}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid-2">
                <div className="input-group"><label>Name *</label><input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="input-group"><label>Type</label>
                  <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="customer">Customer</option><option value="supplier">Supplier</option><option value="both">Both</option>
                  </select>
                </div>
                <div className="input-group"><label>Phone</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="input-group"><label>Email</label><input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div className="input-group"><label>GSTIN</label><input className="input" value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} /></div>
                <div className="input-group"><label>PAN</label><input className="input" value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value })} /></div>
                <div className="input-group"><label>Credit Limit (₹)</label><input className="input" type="number" min="0" value={form.creditLimit} onChange={e => setForm({ ...form, creditLimit: Number(e.target.value) })} /></div>
                <div className="input-group"><label>Payment Terms (days)</label><input className="input" type="number" min="0" value={form.paymentTermDays} onChange={e => setForm({ ...form, paymentTermDays: Number(e.target.value) })} /></div>
              </div>
              <div className="input-group"><label>Address</label><input className="input mb-8" placeholder="Street" value={form.billingAddress.line1} onChange={e => setForm({ ...form, billingAddress: { ...form.billingAddress, line1: e.target.value } })} /></div>
              <div className="grid-2">
                <div className="input-group"><input className="input" placeholder="City" value={form.billingAddress.city} onChange={e => setForm({ ...form, billingAddress: { ...form.billingAddress, city: e.target.value } })} /></div>
                <div className="input-group"><input className="input" placeholder="State" value={form.billingAddress.state} onChange={e => setForm({ ...form, billingAddress: { ...form.billingAddress, state: e.target.value } })} /></div>
              </div>
              <div className="input-group"><label>Notes</label><textarea className="input" rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{editParty ? 'Update' : 'Create'} Party</button>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-16"><h2>Import Parties</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowImport(false)}><FiX /></button></div>
            <p className="text-secondary mb-8">Enter one party per line: Name, Phone, Email, Type, GSTIN</p>
            <textarea className="input mb-16" rows="10" placeholder="John Doe, 9876543210, john@email.com, customer, 22AAAAA0000A1Z5" value={importText} onChange={e => setImportText(e.target.value)} />
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleImport}>Import Parties</button>
          </div>
        </div>
      )}

      {/* Custom Pricing Modal */}
      {showPricing && (
        <PricingModal party={showPricing} menuItems={menuItems} onClose={() => setShowPricing(null)} onSave={savePricing} />
      )}
    </div>
  );
};

const PricingModal = ({ party, menuItems, onClose, onSave }) => {
  const [pricing, setPricing] = useState(party.customPricing || []);

  const addItem = (menuItem) => {
    if (pricing.find(p => p.menuItem === menuItem._id)) return;
    setPricing([...pricing, { menuItem: menuItem._id, itemName: menuItem.name, customPrice: menuItem.price }]);
  };

  const updatePrice = (idx, price) => {
    const updated = [...pricing];
    updated[idx].customPrice = Number(price);
    setPricing(updated);
  };

  const removeItem = (idx) => {
    setPricing(pricing.filter((_, i) => i !== idx));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="flex-between mb-16"><h2>Custom Pricing - {party.name}</h2><button className="btn btn-secondary btn-sm" onClick={onClose}><FiX /></button></div>
        <div className="mb-16">
          <select className="input" onChange={e => { const item = menuItems.find(m => m._id === e.target.value); if (item) addItem(item); e.target.value = ''; }}>
            <option value="">Add menu item...</option>
            {menuItems.map(m => <option key={m._id} value={m._id}>{m.name} - ₹{m.price}</option>)}
          </select>
        </div>
        {pricing.length === 0 ? <p className="text-secondary">No custom pricing set. Using default prices.</p> : (
          <table className="data-table mb-16">
            <thead><tr><th>Item</th><th>Custom Price</th><th></th></tr></thead>
            <tbody>
              {pricing.map((p, idx) => (
                <tr key={idx}>
                  <td>{p.itemName}</td>
                  <td><input className="input" type="number" min="0" style={{ width: 100 }} value={p.customPrice} onChange={e => updatePrice(idx, e.target.value)} /></td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => removeItem(idx)}><FiX /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onSave(party._id, pricing)}>Save Pricing</button>
      </div>
    </div>
  );
};

export default Parties;

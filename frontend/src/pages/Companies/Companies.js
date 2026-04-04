import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiPlus, FiEdit2, FiTrash2, FiCheck } from 'react-icons/fi';
import { toast } from 'react-toastify';

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', legalName: '', gstin: '', pan: '', phone: '', email: '', address: { street: '', city: '', state: '', pincode: '' }, bankDetails: { bankName: '', accountNumber: '', ifsc: '', branch: '' } });

  useEffect(() => { fetchCompanies(); }, []);
  const fetchCompanies = async () => {
    try { const res = await api.get('/companies'); setCompanies(res.data); } catch (err) { toast.error('Failed to load companies'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/companies/${editing}`, form); toast.success('Company updated'); }
      else { await api.post('/companies', form); toast.success('Company created'); }
      setShowForm(false); setEditing(null); setForm({ name: '', legalName: '', gstin: '', pan: '', phone: '', email: '', address: { street: '', city: '', state: '', pincode: '' }, bankDetails: { bankName: '', accountNumber: '', ifsc: '', branch: '' } });
      fetchCompanies();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving company'); }
  };

  const switchTo = async (id) => {
    try { await api.patch(`/companies/${id}/switch`); toast.success('Switched company'); fetchCompanies(); } catch (err) { toast.error('Failed to switch'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this company?')) return;
    try { await api.delete(`/companies/${id}`); toast.success('Deleted'); fetchCompanies(); } catch (err) { toast.error('Cannot delete active company'); }
  };

  const editCompany = (c) => {
    setEditing(c._id);
    setForm({ name: c.name, legalName: c.legalName || '', gstin: c.gstin || '', pan: c.pan || '', phone: c.phone || '', email: c.email || '', address: c.address || { street: '', city: '', state: '', pincode: '' }, bankDetails: c.bankDetails || { bankName: '', accountNumber: '', ifsc: '', branch: '' } });
    setShowForm(true);
  };

  return (
    <div>
      <div className="page-header"><h1>Companies</h1><button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditing(null); }}><FiPlus /> Add Company</button></div>

      {showForm && (
        <div className="card mb-24">
          <form onSubmit={handleSubmit}>
            <div className="grid-2 mb-16">
              <div className="input-group"><label>Company Name *</label><input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="input-group"><label>Legal Name</label><input className="input" value={form.legalName} onChange={e => setForm({ ...form, legalName: e.target.value })} /></div>
              <div className="input-group"><label>GSTIN</label><input className="input" value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} /></div>
              <div className="input-group"><label>PAN</label><input className="input" value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value })} /></div>
              <div className="input-group"><label>Phone</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="input-group"><label>Email</label><input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <h4 className="mb-8">Address</h4>
            <div className="grid-2 mb-16">
              <div className="input-group"><label>Street</label><input className="input" value={form.address.street} onChange={e => setForm({ ...form, address: { ...form.address, street: e.target.value } })} /></div>
              <div className="input-group"><label>City</label><input className="input" value={form.address.city} onChange={e => setForm({ ...form, address: { ...form.address, city: e.target.value } })} /></div>
              <div className="input-group"><label>State</label><input className="input" value={form.address.state} onChange={e => setForm({ ...form, address: { ...form.address, state: e.target.value } })} /></div>
              <div className="input-group"><label>Pincode</label><input className="input" value={form.address.pincode} onChange={e => setForm({ ...form, address: { ...form.address, pincode: e.target.value } })} /></div>
            </div>
            <h4 className="mb-8">Bank Details</h4>
            <div className="grid-2 mb-16">
              <div className="input-group"><label>Bank Name</label><input className="input" value={form.bankDetails.bankName} onChange={e => setForm({ ...form, bankDetails: { ...form.bankDetails, bankName: e.target.value } })} /></div>
              <div className="input-group"><label>Account Number</label><input className="input" value={form.bankDetails.accountNumber} onChange={e => setForm({ ...form, bankDetails: { ...form.bankDetails, accountNumber: e.target.value } })} /></div>
              <div className="input-group"><label>IFSC</label><input className="input" value={form.bankDetails.ifsc} onChange={e => setForm({ ...form, bankDetails: { ...form.bankDetails, ifsc: e.target.value } })} /></div>
              <div className="input-group"><label>Branch</label><input className="input" value={form.bankDetails.branch} onChange={e => setForm({ ...form, bankDetails: { ...form.bankDetails, branch: e.target.value } })} /></div>
            </div>
            <div className="flex gap-8"><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button><button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button></div>
          </form>
        </div>
      )}

      <div className="grid-3">
        {companies.map(c => (
          <div key={c._id} className="card" style={{ border: c.isDefault ? '2px solid var(--accent)' : undefined }}>
            <div className="flex justify-between mb-8"><h3>{c.name}</h3>{c.isDefault && <span className="badge badge-success">Active</span>}</div>
            {c.gstin && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>GSTIN: {c.gstin}</p>}
            {c.phone && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Phone: {c.phone}</p>}
            {c.email && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Email: {c.email}</p>}
            <div className="flex gap-8 mt-12">
              {!c.isDefault && <button className="btn btn-success btn-sm" onClick={() => switchTo(c._id)}><FiCheck /> Switch</button>}
              <button className="btn btn-secondary btn-sm" onClick={() => editCompany(c)}><FiEdit2 /></button>
              {!c.isDefault && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c._id)}><FiTrash2 /></button>}
            </div>
          </div>
        ))}
      </div>
      {companies.length === 0 && <div className="empty-state"><p>No companies yet. Add your first company.</p></div>}
    </div>
  );
};

export default Companies;

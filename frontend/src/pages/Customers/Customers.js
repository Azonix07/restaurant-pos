import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiPlus, FiSearch, FiStar, FiPhone, FiGift, FiClock } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Customers.css';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewCustomer, setViewCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', gstin: '', dateOfBirth: '', anniversary: '' });
  const [editing, setEditing] = useState(null);

  const fetchCustomers = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (tierFilter) params.tier = tierFilter;
      const res = await api.get('/customers', { params });
      setCustomers(res.data.customers);
      setTotal(res.data.total);
    } catch (err) { toast.error('Failed to load customers'); }
  }, [search, tierFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/customers/${editing}`, form); toast.success('Updated'); }
      else { await api.post('/customers', form); toast.success('Customer added'); }
      setShowForm(false); setEditing(null);
      setForm({ name: '', phone: '', email: '', address: '', gstin: '', dateOfBirth: '', anniversary: '' });
      fetchCustomers();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const viewHistory = async (cust) => {
    setViewCustomer(cust);
    try {
      const res = await api.get(`/customers/${cust._id}/orders`);
      setOrders(res.data.orders);
    } catch (err) { toast.error('Failed to load history'); }
  };

  const editCustomer = (c) => {
    setEditing(c._id);
    setForm({ name: c.name, phone: c.phone, email: c.email || '', address: c.address || '', gstin: c.gstin || '', dateOfBirth: c.dateOfBirth ? c.dateOfBirth.split('T')[0] : '', anniversary: c.anniversary ? c.anniversary.split('T')[0] : '' });
    setShowForm(true);
  };

  const tierColors = { bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700', platinum: '#e5e4e2' };

  return (
    <div>
      <div className="page-header">
        <h1>Customers ({total})</h1>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditing(null); }}><FiPlus /> Add Customer</button>
      </div>

      <div className="flex gap-12 mb-16">
        <div className="input-group" style={{ flex: 1 }}>
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
            <input className="input" placeholder="Search by name or phone..." style={{ paddingLeft: 36 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <select className="input" style={{ width: 150 }} value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
          <option value="">All Tiers</option>
          <option value="bronze">Bronze</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="platinum">Platinum</option>
        </select>
      </div>

      {showForm && (
        <div className="card mb-24">
          <form onSubmit={handleSubmit}>
            <div className="grid-3 mb-16">
              <div className="input-group"><label>Name *</label><input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="input-group"><label>Phone *</label><input className="input" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="input-group"><label>Email</label><input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="input-group"><label>Address</label><input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="input-group"><label>GSTIN</label><input className="input" value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} /></div>
              <div className="input-group"><label>Date of Birth</label><input className="input" type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
            </div>
            <div className="flex gap-8"><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Add'}</button><button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button></div>
          </form>
        </div>
      )}

      {viewCustomer && (
        <div className="card mb-24">
          <div className="flex justify-between mb-16">
            <div>
              <h3>{viewCustomer.name}</h3>
              <p className="text-secondary"><FiPhone /> {viewCustomer.phone}</p>
            </div>
            <div className="text-right">
              <span className="badge" style={{ background: tierColors[viewCustomer.tier] || '#999', color: viewCustomer.tier === 'gold' ? '#333' : '#fff' }}><FiStar /> {(viewCustomer.tier || 'bronze').toUpperCase()}</span>
              <p className="mt-8"><FiGift /> {viewCustomer.loyaltyPoints} points</p>
            </div>
          </div>
          <div className="grid-3 mb-16">
            <div className="stat-card"><div className="stat-label">Total Orders</div><div className="stat-value">{viewCustomer.totalOrders}</div></div>
            <div className="stat-card"><div className="stat-label">Total Spent</div><div className="stat-value">₹{viewCustomer.totalSpent?.toLocaleString()}</div></div>
            <div className="stat-card"><div className="stat-label">Last Visit</div><div className="stat-value">{viewCustomer.lastVisit ? new Date(viewCustomer.lastVisit).toLocaleDateString() : 'N/A'}</div></div>
          </div>
          <h4 className="mb-8">Recent Orders</h4>
          {orders.length === 0 ? <p className="text-secondary">No orders found.</p> :
            <table className="table"><thead><tr><th>Order #</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>{orders.slice(0, 20).map(o => (
                <tr key={o._id}><td>{o.orderNumber}</td><td>{new Date(o.createdAt).toLocaleDateString()}</td><td>₹{o.total}</td><td><span className={`badge badge-${o.paymentStatus === 'paid' ? 'success' : 'warning'}`}>{o.paymentStatus}</span></td></tr>
              ))}</tbody>
            </table>
          }
          <button className="btn btn-secondary mt-12" onClick={() => setViewCustomer(null)}>Close</button>
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead><tr><th>Name</th><th>Phone</th><th>Tier</th><th>Points</th><th>Orders</th><th>Total Spent</th><th>Actions</th></tr></thead>
          <tbody>
            {customers.map(c => (
              <tr key={c._id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.phone}</td>
                <td><span className="badge" style={{ background: tierColors[c.tier], color: c.tier === 'gold' ? '#333' : '#fff', fontSize: '0.7rem' }}>{c.tier}</span></td>
                <td>{c.loyaltyPoints}</td>
                <td>{c.totalOrders}</td>
                <td>₹{c.totalSpent?.toLocaleString()}</td>
                <td>
                  <div className="flex gap-4">
                    <button className="btn btn-sm btn-secondary" onClick={() => viewHistory(c)}><FiClock /></button>
                    <button className="btn btn-sm btn-secondary" onClick={() => editCustomer(c)}>Edit</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Customers;

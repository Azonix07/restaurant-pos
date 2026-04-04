import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiPlus, FiX, FiFileText, FiSend, FiCheckCircle, FiTruck, FiXCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Invoices.css';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [parties, setParties] = useState([]);
  const [activeTab, setActiveTab] = useState('sale');
  const [showCreate, setShowCreate] = useState(false);
  const [showCombine, setShowCombine] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [form, setForm] = useState({
    type: 'sale', party: '', date: new Date().toISOString().split('T')[0],
    items: [{ name: '', quantity: 1, rate: 0, gstRate: 5, hsn: '', amount: 0 }], notes: '',
  });
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const fetchInvoices = async () => {
    try {
      const res = await api.get(`/invoices?type=${activeTab}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      setInvoices(res.data.invoices || []);
    } catch (err) { console.error(err); }
  };

  const fetchParties = async () => {
    try { const res = await api.get('/parties'); setParties(res.data.parties || []); } catch (err) { console.error(err); }
  };

  const fetchActiveOrders = async () => {
    try { const res = await api.get('/orders?status=completed&limit=50'); setActiveOrders(res.data.orders || []); } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchInvoices(); }, [activeTab, dateRange]);
  useEffect(() => { fetchParties(); }, []);

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx][field] = field === 'name' || field === 'hsn' ? value : Number(value);
    items[idx].amount = items[idx].quantity * items[idx].rate;
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { name: '', quantity: 1, rate: 0, gstRate: 5, hsn: '', amount: 0 }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const createInvoice = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form, items: form.items.map(i => ({ ...i, amount: i.quantity * i.rate })) };
      await api.post('/invoices', data);
      toast.success('Invoice created');
      setShowCreate(false);
      fetchInvoices();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const combineOrders = async () => {
    if (selectedOrders.length < 2) { toast.error('Select at least 2 orders'); return; }
    try {
      await api.post('/invoices/combine-orders', { orderIds: selectedOrders });
      toast.success('Orders combined into invoice');
      setShowCombine(false);
      setSelectedOrders([]);
      fetchInvoices();
    } catch (err) { toast.error('Failed'); }
  };

  const cancelInvoice = async (id) => {
    const reason = window.prompt('Reason for cancellation:');
    if (!reason) return;
    try {
      await api.post(`/invoices/${id}/cancel`, { reason });
      toast.success('Invoice cancelled');
      fetchInvoices();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const generateEInvoice = async (id) => {
    try {
      const res = await api.post(`/invoices/${id}/e-invoice`);
      toast.success(res.data.message);
      fetchInvoices();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const generateEWayBill = async (id) => {
    const vehicleNumber = window.prompt('Vehicle Number:');
    if (!vehicleNumber) return;
    try {
      const res = await api.post(`/invoices/${id}/e-way-bill`, { vehicleNumber, transporterName: 'Self' });
      toast.success(res.data.message);
      fetchInvoices();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const sendWhatsApp = async (id) => {
    try {
      const res = await api.post(`/invoices/${id}/whatsapp`);
      window.open(res.data.whatsappUrl, '_blank');
      toast.success('Opening WhatsApp...');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const recordPayment = async (id) => {
    const amount = window.prompt('Payment amount:');
    if (!amount || isNaN(amount)) return;
    try {
      await api.post(`/invoices/${id}/payment`, { amount: Number(amount) });
      toast.success('Payment recorded');
      fetchInvoices();
    } catch (err) { toast.error('Failed'); }
  };

  const totalInvoiceValue = invoices.reduce((s, i) => s + (i.isCancelled ? 0 : i.total), 0);
  const totalDue = invoices.reduce((s, i) => s + (i.isCancelled ? 0 : i.balanceDue), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Invoices & Billing</h1>
        <div className="flex gap-8">
          <input type="date" className="input" style={{ width: 'auto' }} value={dateRange.startDate} onChange={e => setDateRange(p => ({ ...p, startDate: e.target.value }))} />
          <input type="date" className="input" style={{ width: 'auto' }} value={dateRange.endDate} onChange={e => setDateRange(p => ({ ...p, endDate: e.target.value }))} />
        </div>
      </div>

      <div className="report-tabs mb-16">
        {[{ id: 'sale', label: 'Sales' }, { id: 'purchase', label: 'Purchases' }, { id: 'credit_note', label: 'Credit Notes' }, { id: 'debit_note', label: 'Debit Notes' }].map(tab => (
          <button key={tab.id} className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </div>

      <div className="grid-3 mb-24">
        <div className="stat-card"><div className="stat-label">Invoices</div><div className="stat-value">{invoices.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Value</div><div className="stat-value">₹{totalInvoiceValue.toLocaleString('en-IN')}</div></div>
        <div className="stat-card"><div className="stat-label">Balance Due</div><div className="stat-value" style={{ color: totalDue > 0 ? 'var(--danger)' : 'var(--success)' }}>₹{totalDue.toLocaleString('en-IN')}</div></div>
      </div>

      <div className="card">
        <div className="flex-between mb-16">
          <h3>{activeTab === 'sale' ? 'Sales' : activeTab === 'purchase' ? 'Purchase' : 'Credit/Debit'} Invoices</h3>
          <div className="flex gap-8">
            <button className="btn btn-secondary" onClick={() => { fetchActiveOrders(); setShowCombine(true); }}>Combine Orders</button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}><FiPlus /> New Invoice</button>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Date</th><th>Party</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th><th>E-Invoice</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv._id} style={inv.isCancelled ? { opacity: 0.5, textDecoration: 'line-through' } : {}}>
                  <td>{inv.invoiceNumber}</td>
                  <td>{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                  <td>{inv.partyName || inv.party?.name || '-'}</td>
                  <td>₹{inv.total?.toFixed(2)}</td>
                  <td>₹{inv.amountPaid?.toFixed(2)}</td>
                  <td style={{ color: inv.balanceDue > 0 ? 'var(--danger)' : 'var(--success)' }}>₹{inv.balanceDue?.toFixed(2)}</td>
                  <td><span className={`badge badge-${inv.isCancelled ? 'cancelled' : inv.paymentStatus}`}>{inv.isCancelled ? 'Cancelled' : inv.paymentStatus}</span></td>
                  <td>
                    {inv.eInvoiceStatus === 'generated' ? <span className="badge badge-completed">IRN ✓</span> : <span className="text-secondary">-</span>}
                    {inv.eWayBillNumber && <span className="badge badge-completed" style={{ marginLeft: 4 }}>EWB ✓</span>}
                  </td>
                  <td>
                    {!inv.isCancelled && (
                      <div className="flex gap-4">
                        {inv.balanceDue > 0 && <button className="btn btn-success btn-sm" onClick={() => recordPayment(inv._id)} title="Record Payment">₹</button>}
                        {inv.eInvoiceStatus !== 'generated' && <button className="btn btn-secondary btn-sm" onClick={() => generateEInvoice(inv._id)} title="E-Invoice"><FiFileText /></button>}
                        {inv.total >= 50000 && !inv.eWayBillNumber && <button className="btn btn-secondary btn-sm" onClick={() => generateEWayBill(inv._id)} title="E-Way Bill"><FiTruck /></button>}
                        <button className="btn btn-success btn-sm" onClick={() => sendWhatsApp(inv._id)} title="WhatsApp"><FiSend /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => cancelInvoice(inv._id)} title="Cancel"><FiXCircle /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan="9" className="text-center text-secondary">No invoices</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="flex-between mb-16"><h2>New Invoice</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}><FiX /></button></div>
            <form onSubmit={createInvoice}>
              <div className="grid-2 mb-16">
                <div className="input-group"><label>Type</label>
                  <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="sale">Sale</option><option value="purchase">Purchase</option>
                    <option value="credit_note">Credit Note</option><option value="debit_note">Debit Note</option>
                  </select>
                </div>
                <div className="input-group"><label>Party</label>
                  <select className="input" value={form.party} onChange={e => setForm({ ...form, party: e.target.value })}>
                    <option value="">Select Party (optional)</option>
                    {parties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="input-group"><label>Date</label><input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              </div>
              <h4 className="mb-8">Items</h4>
              <table className="data-table mb-8">
                <thead><tr><th>Name</th><th>HSN</th><th>Qty</th><th>Rate</th><th>GST%</th><th>Amount</th><th></th></tr></thead>
                <tbody>
                  {form.items.map((item, idx) => (
                    <tr key={idx}>
                      <td><input className="input" style={{ minWidth: 120 }} value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} required /></td>
                      <td><input className="input" style={{ width: 80 }} value={item.hsn} onChange={e => updateItem(idx, 'hsn', e.target.value)} /></td>
                      <td><input className="input" type="number" min="1" style={{ width: 60 }} value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} /></td>
                      <td><input className="input" type="number" min="0" style={{ width: 80 }} value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} /></td>
                      <td><input className="input" type="number" style={{ width: 60 }} value={item.gstRate} onChange={e => updateItem(idx, 'gstRate', e.target.value)} /></td>
                      <td>₹{(item.quantity * item.rate).toFixed(2)}</td>
                      <td><button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(idx)}><FiX /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="btn btn-secondary btn-sm mb-16" onClick={addItem}><FiPlus /> Add Item</button>
              <div className="input-group"><label>Notes</label><textarea className="input" rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Invoice</button>
            </form>
          </div>
        </div>
      )}

      {/* Combine Orders Modal */}
      {showCombine && (
        <div className="modal-overlay" onClick={() => setShowCombine(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-16"><h2>Combine Orders</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowCombine(false)}><FiX /></button></div>
            <p className="text-secondary mb-16">Select orders to combine into a single invoice</p>
            {activeOrders.map(order => (
              <label key={order._id} className="flex gap-8 mb-8" style={{ alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedOrders.includes(order._id)} onChange={e => {
                  setSelectedOrders(e.target.checked ? [...selectedOrders, order._id] : selectedOrders.filter(id => id !== order._id));
                }} />
                <span>{order.orderNumber} - ₹{order.total?.toFixed(2)} ({order.items?.length} items)</span>
              </label>
            ))}
            {activeOrders.length === 0 && <p className="text-secondary">No completed orders to combine</p>}
            <button className="btn btn-primary mt-16" style={{ width: '100%' }} onClick={combineOrders} disabled={selectedOrders.length < 2}>
              Combine {selectedOrders.length} Orders
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;

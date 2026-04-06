import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiTruck, FiPlus, FiEdit2, FiSearch, FiFileText, FiPackage, FiDollarSign, FiX, FiChevronLeft } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Suppliers.css';

const Suppliers = () => {
  const [view, setView] = useState('suppliers'); // suppliers | supplier-detail | po-create | po-detail
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', gstin: '', category: 'general', paymentTerms: 30 });
  const [editingId, setEditingId] = useState(null);

  // PO form state
  const [poForm, setPoForm] = useState({ items: [{ name: '', quantity: 1, unitPrice: 0, unit: 'kg' }], notes: '' });

  // GRN state
  const [showGRN, setShowGRN] = useState(false);
  const [grnItems, setGrnItems] = useState([]);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/purchase/suppliers', { params: { search } });
      setSuppliers(res.data.suppliers || []);
    } catch {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchPOs = useCallback(async (supplierId) => {
    try {
      const res = await api.get('/purchase/orders', { params: { supplier: supplierId } });
      setPurchaseOrders(res.data.orders || []);
    } catch {
      toast.error('Failed to load purchase orders');
    }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  // Supplier CRUD
  const saveSupplier = async () => {
    try {
      if (editingId) {
        await api.put(`/purchase/suppliers/${editingId}`, supplierForm);
        toast.success('Supplier updated');
      } else {
        await api.post('/purchase/suppliers', supplierForm);
        toast.success('Supplier created');
      }
      setShowSupplierModal(false);
      resetSupplierForm();
      fetchSuppliers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const resetSupplierForm = () => {
    setSupplierForm({ name: '', phone: '', email: '', gstin: '', category: 'general', paymentTerms: 30 });
    setEditingId(null);
  };

  const editSupplier = (s) => {
    setSupplierForm({ name: s.name, phone: s.phone, email: s.email || '', gstin: s.gstin || '', category: s.category, paymentTerms: s.paymentTerms });
    setEditingId(s._id);
    setShowSupplierModal(true);
  };

  const openSupplier = (s) => {
    setSelectedSupplier(s);
    fetchPOs(s._id);
    setView('supplier-detail');
  };

  // Purchase Order
  const addPOItem = () => {
    setPoForm(p => ({ ...p, items: [...p.items, { name: '', quantity: 1, unitPrice: 0, unit: 'kg' }] }));
  };

  const updatePOItem = (idx, field, value) => {
    setPoForm(p => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...p, items };
    });
  };

  const removePOItem = (idx) => {
    setPoForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  };

  const createPO = async () => {
    try {
      const payload = { supplierId: selectedSupplier._id, items: poForm.items, notes: poForm.notes };
      const res = await api.post('/purchase/orders', payload);
      toast.success(`PO ${res.data.order.poNumber} created`);
      setView('supplier-detail');
      setPoForm({ items: [{ name: '', quantity: 1, unitPrice: 0, unit: 'kg' }], notes: '' });
      fetchPOs(selectedSupplier._id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create PO');
    }
  };

  // GRN
  const openGRN = (po) => {
    setSelectedPO(po);
    setGrnItems(po.items.map(i => ({
      name: i.name,
      orderedQty: i.quantity,
      receivedQty: i.receivedQuantity || 0,
      newQty: 0,
    })));
    setShowGRN(true);
  };

  const submitGRN = async () => {
    try {
      const items = grnItems.filter(i => i.newQty > 0).map(i => ({
        name: i.name,
        quantity: i.newQty,
      }));
      if (items.length === 0) { toast.error('Enter received quantities'); return; }
      await api.post(`/purchase/orders/${selectedPO._id}/receive`, { items });
      toast.success('GRN recorded');
      setShowGRN(false);
      fetchPOs(selectedSupplier._id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'GRN failed');
    }
  };

  // Payment
  const recordPayment = async (poId) => {
    const amount = prompt('Payment amount:');
    if (!amount || isNaN(amount)) return;
    const method = prompt('Method (cash/bank/upi):') || 'cash';
    try {
      await api.post(`/purchase/orders/${poId}/payment`, { amount: parseFloat(amount), method });
      toast.success('Payment recorded');
      fetchPOs(selectedSupplier._id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    }
  };

  const statusColor = (s) => ({
    draft: '#6b7280', ordered: '#3b82f6', partial_received: '#f59e0b', received: '#22c55e', cancelled: '#ef4444',
  }[s] || '#6b7280');

  // ─── Supplier List View ────────────────────────
  if (view === 'suppliers') {
    return (
      <div className="suppliers-page">
        <div className="page-header">
          <h1><FiTruck /> Suppliers & Purchase</h1>
          <button className="btn btn-primary" onClick={() => { resetSupplierForm(); setShowSupplierModal(true); }}>
            <FiPlus /> Add Supplier
          </button>
        </div>

        <div className="supplier-search">
          <FiSearch />
          <input className="input" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="text-center" style={{ padding: 40 }}>Loading...</div>
        ) : (
          <div className="supplier-grid">
            {suppliers.map(s => (
              <div key={s._id} className="supplier-card" onClick={() => openSupplier(s)}>
                <div className="supplier-card-header">
                  <strong>{s.name}</strong>
                  <span className="badge">{s.category}</span>
                </div>
                <div className="supplier-card-body">
                  <div>{s.phone}</div>
                  {s.gstin && <div className="text-secondary">GSTIN: {s.gstin}</div>}
                  <div className="supplier-stats">
                    <span>Orders: {s.totalOrders}</span>
                    <span>Spent: ₹{(s.totalSpent || 0).toLocaleString()}</span>
                    {s.currentBalance > 0 && (
                      <span className="balance-due">Due: ₹{s.currentBalance.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <button className="btn btn-sm edit-btn" onClick={(e) => { e.stopPropagation(); editSupplier(s); }}>
                  <FiEdit2 />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Supplier Modal */}
        {showSupplierModal && (
          <div className="modal-overlay" onClick={() => setShowSupplierModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingId ? 'Edit' : 'Add'} Supplier</h3>
                <button className="btn btn-sm" onClick={() => setShowSupplierModal(false)}><FiX /></button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Name *</label>
                  <input className="input" value={supplierForm.name} onChange={e => setSupplierForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone *</label>
                    <input className="input" value={supplierForm.phone} onChange={e => setSupplierForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input className="input" value={supplierForm.email} onChange={e => setSupplierForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>GSTIN</label>
                    <input className="input" value={supplierForm.gstin} onChange={e => setSupplierForm(p => ({ ...p, gstin: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select className="input" value={supplierForm.category} onChange={e => setSupplierForm(p => ({ ...p, category: e.target.value }))}>
                      <option value="general">General</option>
                      <option value="vegetables">Vegetables</option>
                      <option value="dairy">Dairy</option>
                      <option value="meat">Meat</option>
                      <option value="beverages">Beverages</option>
                      <option value="packaging">Packaging</option>
                      <option value="equipment">Equipment</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Payment Terms (days)</label>
                  <input className="input" type="number" value={supplierForm.paymentTerms} onChange={e => setSupplierForm(p => ({ ...p, paymentTerms: parseInt(e.target.value) || 30 }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn" onClick={() => setShowSupplierModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveSupplier} disabled={!supplierForm.name || !supplierForm.phone}>Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Supplier Detail View ──────────────────────
  if (view === 'supplier-detail' && selectedSupplier) {
    return (
      <div className="suppliers-page">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-sm" onClick={() => setView('suppliers')}>
              <FiChevronLeft /> Back
            </button>
            <h1>{selectedSupplier.name}</h1>
          </div>
          <button className="btn btn-primary" onClick={() => setView('po-create')}>
            <FiPlus /> New Purchase Order
          </button>
        </div>

        <div className="po-list">
          {purchaseOrders.length === 0 ? (
            <div className="text-center" style={{ padding: 40, color: '#6b7280' }}>No purchase orders yet</div>
          ) : (
            purchaseOrders.map(po => (
              <div key={po._id} className="po-card">
                <div className="po-card-header">
                  <div>
                    <strong>{po.poNumber}</strong>
                    <span className="po-date">{new Date(po.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  <span className="po-status" style={{ color: statusColor(po.status) }}>{po.status.replace('_', ' ')}</span>
                </div>
                <div className="po-card-body">
                  <div className="po-items-summary">{po.items?.length} items — ₹{po.total?.toFixed(2)}</div>
                  <div className="po-payment">
                    Paid: ₹{(po.paidAmount || 0).toFixed(2)} / ₹{po.total?.toFixed(2)}
                    {po.paymentStatus !== 'paid' && <span className="payment-due"> ({po.paymentStatus})</span>}
                  </div>
                </div>
                <div className="po-card-actions">
                  {['ordered', 'partial_received'].includes(po.status) && (
                    <button className="btn btn-sm btn-primary" onClick={() => openGRN(po)}>
                      <FiPackage /> Receive Goods
                    </button>
                  )}
                  {po.paymentStatus !== 'paid' && (
                    <button className="btn btn-sm" onClick={() => recordPayment(po._id)}>
                      <FiDollarSign /> Pay
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* GRN Modal */}
        {showGRN && selectedPO && (
          <div className="modal-overlay" onClick={() => setShowGRN(false)}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Receive Goods — {selectedPO.poNumber}</h3>
                <button className="btn btn-sm" onClick={() => setShowGRN(false)}><FiX /></button>
              </div>
              <div className="modal-body">
                <table className="data-table">
                  <thead>
                    <tr><th>Item</th><th>Ordered</th><th>Received</th><th>New Qty</th></tr>
                  </thead>
                  <tbody>
                    {grnItems.map((item, i) => (
                      <tr key={i}>
                        <td>{item.name}</td>
                        <td>{item.orderedQty}</td>
                        <td>{item.receivedQty}</td>
                        <td>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            max={item.orderedQty - item.receivedQty}
                            value={item.newQty}
                            onChange={e => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setGrnItems(p => { const n = [...p]; n[i] = { ...n[i], newQty: val }; return n; });
                            }}
                            style={{ width: 80 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button className="btn" onClick={() => setShowGRN(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={submitGRN}>Record GRN</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Create PO View ───────────────────────────
  if (view === 'po-create' && selectedSupplier) {
    const total = poForm.items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
    return (
      <div className="suppliers-page">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-sm" onClick={() => setView('supplier-detail')}>
              <FiChevronLeft /> Back
            </button>
            <h1>New Purchase Order — {selectedSupplier.name}</h1>
          </div>
        </div>

        <div className="po-form card">
          <h3>Items</h3>
          {poForm.items.map((item, i) => (
            <div key={i} className="po-item-row">
              <input className="input" placeholder="Item name" value={item.name} onChange={e => updatePOItem(i, 'name', e.target.value)} />
              <input className="input" type="number" placeholder="Qty" value={item.quantity} onChange={e => updatePOItem(i, 'quantity', parseInt(e.target.value) || 0)} style={{ width: 80 }} />
              <select className="input" value={item.unit} onChange={e => updatePOItem(i, 'unit', e.target.value)} style={{ width: 80 }}>
                <option>kg</option><option>g</option><option>L</option><option>ml</option><option>pcs</option><option>box</option>
              </select>
              <input className="input" type="number" placeholder="Unit Price" value={item.unitPrice} onChange={e => updatePOItem(i, 'unitPrice', parseFloat(e.target.value) || 0)} style={{ width: 100 }} />
              <span className="po-item-total">₹{(item.quantity * item.unitPrice).toFixed(2)}</span>
              {poForm.items.length > 1 && (
                <button className="btn btn-sm btn-danger" onClick={() => removePOItem(i)}><FiX /></button>
              )}
            </div>
          ))}
          <button className="btn btn-sm" onClick={addPOItem}><FiPlus /> Add Item</button>

          <div className="form-group" style={{ marginTop: 16 }}>
            <label>Notes</label>
            <textarea className="input" rows={2} value={poForm.notes} onChange={e => setPoForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="po-total">
            Total: <strong>₹{total.toFixed(2)}</strong>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn" onClick={() => setView('supplier-detail')}>Cancel</button>
            <button className="btn btn-primary" onClick={createPO} disabled={poForm.items.some(i => !i.name)}>
              <FiFileText /> Create PO
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Suppliers;

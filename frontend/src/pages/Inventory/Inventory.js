import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiPlus, FiX, FiUpload, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Inventory.css';

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showPricing, setShowPricing] = useState(null);
  const [bulkUpdates, setBulkUpdates] = useState([]);
  const [importText, setImportText] = useState('');
  const [search, setSearch] = useState('');
  const [editingBarcode, setEditingBarcode] = useState(null);
  const [barcodeValue, setBarcodeValue] = useState('');

  const fetchItems = async () => {
    try {
      const params = new URLSearchParams();
      if (activeTab === 'lowStock') params.set('lowStock', 'true');
      if (search) params.set('search', search);
      const res = await api.get(`/inventory?${params}`);
      setItems(res.data.items || []);
    } catch (err) {
      // Fallback to menu endpoint
      try {
        const res = await api.get('/menu');
        setItems(res.data.items || []);
      } catch (e) { console.error(e); }
    }
  };

  useEffect(() => { fetchItems(); }, [activeTab, search]);

  const handleBulkUpdate = async () => {
    if (bulkUpdates.length === 0) { toast.error('No updates'); return; }
    try {
      const res = await api.post('/inventory/bulk-update', { updates: bulkUpdates });
      toast.success(`Updated ${res.data.results.updated} items`);
      setShowBulkUpdate(false);
      setBulkUpdates([]);
      fetchItems();
    } catch (err) { toast.error('Failed'); }
  };

  const addBulkItem = (item) => {
    if (bulkUpdates.find(u => u.id === item._id)) return;
    setBulkUpdates([...bulkUpdates, { id: item._id, name: item.name, fields: { price: item.price, stock: item.stock || 0 } }]);
  };

  const updateBulkField = (idx, field, value) => {
    const updated = [...bulkUpdates];
    updated[idx].fields[field] = Number(value);
    setBulkUpdates(updated);
  };

  const handleImport = async () => {
    try {
      const lines = importText.trim().split('\n').filter(l => l.trim());
      const itemsList = lines.map(line => {
        const [name, category, price, isVeg] = line.split(',').map(s => s.trim());
        return { name, category: category || 'Imported', price: Number(price) || 0, isVeg: isVeg !== 'false' };
      });
      const res = await api.post('/inventory/bulk-import', { items: itemsList });
      toast.success(`Imported: ${res.data.results.created} created, ${res.data.results.skipped} skipped`);
      setShowBulkImport(false);
      setImportText('');
      fetchItems();
    } catch (err) { toast.error('Failed'); }
  };

  const savePricing = async (id, prices) => {
    try {
      await api.put(`/inventory/${id}/pricing`, { prices });
      toast.success('Multiple pricing saved');
      setShowPricing(null);
      fetchItems();
    } catch (err) { toast.error('Failed'); }
  };

  const saveBarcode = async (itemId) => {
    try {
      await api.put(`/menu/${itemId}`, { barcode: barcodeValue });
      toast.success('Barcode saved');
      setEditingBarcode(null);
      setBarcodeValue('');
      fetchItems();
    } catch (err) { toast.error('Failed to save barcode'); }
  };

  const categories = [...new Set(items.map(i => i.category))];
  const lowStockItems = items.filter(i => (i.stock || 0) <= (i.lowStockThreshold || 10));

  return (
    <div>
      <div className="page-header">
        <h1>Inventory Management</h1>
        <div className="flex gap-8">
          <input className="input" placeholder="Search items..." style={{ width: 200 }} value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-secondary" onClick={() => setShowBulkImport(true)}><FiUpload /> Import</button>
          <button className="btn btn-primary" onClick={() => { setBulkUpdates([]); setShowBulkUpdate(true); }}><FiEdit2 /> Bulk Update</button>
        </div>
      </div>

      <div className="report-tabs mb-16">
        <button className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('all')}>All Items ({items.length})</button>
        <button className={`btn ${activeTab === 'lowStock' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('lowStock')}>Low Stock ({lowStockItems.length})</button>
        {categories.map(cat => (
          <button key={cat} className={`btn ${activeTab === cat ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(cat)}>{cat}</button>
        ))}
      </div>

      <div className="grid-4 mb-24">
        <div className="stat-card"><div className="stat-label">Total Items</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card"><div className="stat-label">Categories</div><div className="stat-value">{categories.length}</div></div>
        <div className="stat-card"><div className="stat-label">Low Stock</div><div className="stat-value" style={{ color: lowStockItems.length > 0 ? 'var(--danger)' : 'var(--success)' }}>{lowStockItems.length}</div></div>
        <div className="stat-card"><div className="stat-label">Avg Price</div><div className="stat-value">₹{items.length > 0 ? Math.round(items.reduce((s, i) => s + i.price, 0) / items.length) : 0}</div></div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Barcode</th><th>Type</th><th>HSN</th><th>Available</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {(activeTab !== 'all' && activeTab !== 'lowStock' ? items.filter(i => i.category === activeTab) : items).map(item => (
              <tr key={item._id}>
                <td><strong>{item.name}</strong>{item.sku && <span className="text-secondary" style={{ fontSize: 11 }}> ({item.sku})</span>}</td>
                <td>{item.category}</td>
                <td>₹{item.price}</td>
                <td style={{ color: (item.stock || 0) <= (item.lowStockThreshold || 10) ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {item.stock || 0}
                </td>
                <td>
                  {editingBarcode === item._id ? (
                    <div className="flex gap-4" style={{ alignItems: 'center' }}>
                      <input
                        className="input"
                        style={{ width: 120, fontSize: 12 }}
                        value={barcodeValue}
                        onChange={e => setBarcodeValue(e.target.value)}
                        placeholder="Scan or type"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') saveBarcode(item._id); if (e.key === 'Escape') setEditingBarcode(null); }}
                      />
                      <button className="btn btn-sm btn-success" onClick={() => saveBarcode(item._id)}>✓</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditingBarcode(null)}>✕</button>
                    </div>
                  ) : (
                    <span
                      style={{ cursor: 'pointer', fontSize: 12, color: item.barcode ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      onClick={() => { setEditingBarcode(item._id); setBarcodeValue(item.barcode || ''); }}
                      title="Click to edit barcode"
                    >
                      {item.barcode || '—  click to set'}
                    </span>
                  )}
                </td>
                <td>{item.isVeg ? '🟢' : '🔴'}</td>
                <td>{item.hsn || '-'}</td>
                <td><span className={`badge ${item.isAvailable ? 'badge-completed' : 'badge-cancelled'}`}>{item.isAvailable ? 'Yes' : 'No'}</span></td>
                <td>
                  <div className="flex gap-4">
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowPricing(item)} title="Multiple Pricing">₹₹</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk Update Modal */}
      {showBulkUpdate && (
        <div className="modal-overlay" onClick={() => setShowBulkUpdate(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="flex-between mb-16"><h2>Bulk Update Items</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowBulkUpdate(false)}><FiX /></button></div>
            <div className="mb-16">
              <select className="input" onChange={e => { const item = items.find(i => i._id === e.target.value); if (item) addBulkItem(item); e.target.value = ''; }}>
                <option value="">Add item to update...</option>
                {items.map(i => <option key={i._id} value={i._id}>{i.name} - ₹{i.price}</option>)}
              </select>
            </div>
            {bulkUpdates.length > 0 && (
              <table className="data-table mb-16">
                <thead><tr><th>Item</th><th>New Price</th><th>New Stock</th><th></th></tr></thead>
                <tbody>
                  {bulkUpdates.map((u, idx) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td><input className="input" type="number" style={{ width: 100 }} value={u.fields.price} onChange={e => updateBulkField(idx, 'price', e.target.value)} /></td>
                      <td><input className="input" type="number" style={{ width: 100 }} value={u.fields.stock} onChange={e => updateBulkField(idx, 'stock', e.target.value)} /></td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => setBulkUpdates(bulkUpdates.filter((_, i) => i !== idx))}><FiX /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleBulkUpdate}>Update {bulkUpdates.length} Items</button>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="modal-overlay" onClick={() => setShowBulkImport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-16"><h2>Import Items</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowBulkImport(false)}><FiX /></button></div>
            <p className="text-secondary mb-8">One item per line: Name, Category, Price, IsVeg(true/false)</p>
            <textarea className="input mb-16" rows="10" placeholder="Paneer Tikka, Starters, 280, true" value={importText} onChange={e => setImportText(e.target.value)} />
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleImport}>Import Items</button>
          </div>
        </div>
      )}

      {/* Multiple Pricing Modal */}
      {showPricing && (
        <MultiplePricingModal item={showPricing} onClose={() => setShowPricing(null)} onSave={savePricing} />
      )}
    </div>
  );
};

const MultiplePricingModal = ({ item, onClose, onSave }) => {
  const [prices, setPrices] = useState(item.prices || { retail: item.price, wholesale: 0, online: 0, special: 0 });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="flex-between mb-16"><h2>Multiple Pricing - {item.name}</h2><button className="btn btn-secondary btn-sm" onClick={onClose}><FiX /></button></div>
        <div className="input-group"><label>Retail Price (₹)</label><input className="input" type="number" value={prices.retail || ''} onChange={e => setPrices({ ...prices, retail: Number(e.target.value) })} /></div>
        <div className="input-group"><label>Wholesale Price (₹)</label><input className="input" type="number" value={prices.wholesale || ''} onChange={e => setPrices({ ...prices, wholesale: Number(e.target.value) })} /></div>
        <div className="input-group"><label>Online Price (₹)</label><input className="input" type="number" value={prices.online || ''} onChange={e => setPrices({ ...prices, online: Number(e.target.value) })} /></div>
        <div className="input-group"><label>Special Price (₹)</label><input className="input" type="number" value={prices.special || ''} onChange={e => setPrices({ ...prices, special: Number(e.target.value) })} /></div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onSave(item._id, prices)}>Save Pricing</button>
      </div>
    </div>
  );
};

export default Inventory;

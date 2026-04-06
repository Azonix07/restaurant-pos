import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiSearch, FiPrinter, FiRefreshCw, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './BarcodeManager.css';

const BarcodeManager = () => {
  const [items, setItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [printModal, setPrintModal] = useState(null);
  const [printerIp, setPrinterIp] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await api.get('/menu');
      const list = res.data.items || [];
      setItems(list);
      setFiltered(list);
    } catch (err) {
      toast.error('Failed to load menu items');
    }
  };

  useEffect(() => { fetchItems(); }, []);

  useEffect(() => {
    if (!search) { setFiltered(items); return; }
    const q = search.toLowerCase();
    setFiltered(items.filter(i => i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q) || i.barcode?.includes(q)));
  }, [search, items]);

  const generateBarcode = async (id) => {
    try {
      await api.post(`/menu/${id}/barcode`);
      toast.success('Barcode generated');
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate barcode');
    }
  };

  const bulkGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/menu/barcode/bulk-generate');
      toast.success(res.data.message || 'Bulk barcodes generated');
      fetchItems();
    } catch (err) {
      toast.error('Bulk generation failed');
    } finally {
      setLoading(false);
    }
  };

  const printBarcode = async () => {
    if (!printerIp.trim()) { toast.error('Enter printer IP'); return; }
    try {
      await api.post(`/menu/${printModal._id}/barcode/print`, { printerIp: printerIp.trim() });
      toast.success('Print job sent');
      setPrintModal(null);
      setPrinterIp('');
    } catch (err) {
      toast.error('Print failed');
    }
  };

  return (
    <div className="barcode-page">
      <div className="page-header">
        <h1>Barcode Manager</h1>
        <button className="btn btn-primary" onClick={bulkGenerate} disabled={loading}><FiRefreshCw /> Bulk Generate</button>
      </div>

      <div className="bc-search mb-16">
        <FiSearch className="bc-search-icon" />
        <input className="input" placeholder="Search items by name, category, or barcode..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <table className="bc-table">
          <thead>
            <tr><th>Name</th><th>Category</th><th>Barcode</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item._id}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{item.barcode ? <code className="bc-code">{item.barcode}</code> : <span className="text-secondary">—</span>}</td>
                <td>
                  <div className="flex gap-8">
                    {!item.barcode && (
                      <button className="btn btn-sm btn-primary" onClick={() => generateBarcode(item._id)}>Generate</button>
                    )}
                    {item.barcode && (
                      <button className="btn btn-sm btn-secondary" onClick={() => setPrintModal(item)}><FiPrinter /> Print</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="4" className="text-center text-secondary" style={{ padding: 40 }}>No items found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {printModal && (
        <div className="bc-modal-overlay" onClick={() => setPrintModal(null)}>
          <div className="bc-modal" onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-16">
              <h3>Print Barcode — {printModal.name}</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setPrintModal(null)}><FiX /></button>
            </div>
            <div className="mb-16">
              <label className="text-secondary" style={{ fontSize: 12 }}>Printer IP Address</label>
              <input className="input" placeholder="e.g. 192.168.1.100" value={printerIp} onChange={e => setPrinterIp(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={printBarcode}><FiPrinter /> Send to Printer</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeManager;

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiDownload } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './QROrder.css';

const QRCodes = () => {
  const [tables, setTables] = useState([]);
  const [serverIP, setServerIP] = useState(window.location.hostname);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await api.get('/tables');
        setTables(res.data.tables || []);
      } catch (err) { console.error(err); }
    };
    fetchTables();
  }, []);

  const generateQR = async (tableId) => {
    try {
      const res = await api.get(`/tables/${tableId}/qr?ip=${serverIP}`);
      setTables(prev => prev.map(t => t._id === tableId ? { ...t, qrCode: res.data.qrCode } : t));
      toast.success('QR Code generated');
    } catch (err) { toast.error('Failed to generate QR'); }
  };

  const generateAll = async () => {
    for (const table of tables) {
      await generateQR(table._id);
    }
    toast.success('All QR codes generated');
  };

  const downloadQR = (table) => {
    if (!table.qrCode) return;
    const link = document.createElement('a');
    link.download = `table-${table.number}-qr.png`;
    link.href = table.qrCode;
    link.click();
  };

  return (
    <div>
      <div className="page-header">
        <h1>QR Code Management</h1>
        <div className="flex gap-8">
          <div className="input-group" style={{ marginBottom: 0 }}>
            <input className="input" placeholder="Server IP" value={serverIP} onChange={e => setServerIP(e.target.value)} style={{ width: 180 }} />
          </div>
          <button className="btn btn-primary" onClick={generateAll}>Generate All</button>
        </div>
      </div>

      <p className="text-secondary mb-24">
        Customers scan these QR codes to place orders from their phones via the local network.
      </p>

      <div className="qr-grid">
        {tables.map(table => (
          <div key={table._id} className="qr-card card">
            <h3>Table {table.number}</h3>
            <p className="text-secondary" style={{ fontSize: '13px' }}>{table.name} · {table.capacity} seats</p>
            <div className="qr-image-container">
              {table.qrCode ? (
                <img src={table.qrCode} alt={`QR for table ${table.number}`} className="qr-image" />
              ) : (
                <div className="qr-placeholder">No QR Generated</div>
              )}
            </div>
            <div className="flex gap-8" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={() => generateQR(table._id)}>Generate</button>
              {table.qrCode && (
                <button className="btn btn-secondary btn-sm" onClick={() => downloadQR(table)}>
                  <FiDownload /> Download
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QRCodes;

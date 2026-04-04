import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { FiClock, FiCheck, FiPrinter, FiAlertCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './KitchenKOT.css';

const KitchenKOT = () => {
  const [kots, setKots] = useState([]);
  const [section, setSection] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchKots = useCallback(async () => {
    try {
      const url = section === 'all' ? '/kot/active' : `/kot/section/${section}`;
      const res = await api.get(url);
      setKots(res.data.kots);
    } catch (err) { toast.error('Failed to load KOTs'); }
    setLoading(false);
  }, [section]);

  useEffect(() => { fetchKots(); }, [fetchKots]);

  useSocket('kot:new', () => fetchKots());
  useSocket('kot:update', () => fetchKots());

  const updateKotStatus = async (id, status) => {
    try {
      await api.patch(`/kot/${id}/status`, { status });
      fetchKots();
    } catch (err) { toast.error('Failed to update KOT'); }
  };

  const updateItemStatus = async (kotId, itemId, status) => {
    try {
      await api.patch(`/kot/${kotId}/item-status`, { itemId, status });
      fetchKots();
    } catch (err) { toast.error('Failed'); }
  };

  const getElapsedMinutes = (createdAt) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  };

  const getUrgencyClass = (minutes) => {
    if (minutes > 30) return 'urgent-critical';
    if (minutes > 15) return 'urgent-warning';
    return '';
  };

  if (loading) return <div className="loading">Loading KOTs...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Kitchen Order Tickets</h1>
        <div className="flex gap-8">
          {['all', 'kitchen', 'bakery', 'bar', 'desserts'].map(s => (
            <button key={s} className={`btn ${section === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSection(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {kots.length === 0 ? (
        <div className="empty-state"><p>No active KOTs</p></div>
      ) : (
        <div className="kot-grid">
          {kots.map(kot => {
            const elapsed = getElapsedMinutes(kot.createdAt);
            return (
              <div key={kot._id} className={`kot-card ${getUrgencyClass(elapsed)} ${kot.isDelta ? 'kot-delta' : ''}`}>
                <div className="kot-header">
                  <div>
                    <span className="kot-number">{kot.kotNumber}</span>
                    {kot.isDelta && <span className="badge badge-warning ml-8">DELTA</span>}
                  </div>
                  <span className={`badge badge-${kot.section}`}>{kot.section.toUpperCase()}</span>
                </div>

                <div className="kot-info">
                  <span>Order: {kot.orderNumber}</span>
                  {kot.tableNumber && <span>Table: {kot.tableNumber}</span>}
                  <span className="kot-timer"><FiClock /> {elapsed}m</span>
                </div>

                <div className="kot-items">
                  {kot.items.map(item => (
                    <div key={item._id} className={`kot-item ${item.status}`}>
                      <div className="kot-item-info">
                        <span className="kot-item-qty">{item.quantity}x</span>
                        <span className="kot-item-name">{item.name}</span>
                        {item.notes && <span className="kot-item-notes">{item.notes}</span>}
                      </div>
                      <div className="kot-item-actions">
                        {item.status === 'pending' && (
                          <button className="btn btn-sm btn-warning" onClick={() => updateItemStatus(kot._id, item._id, 'preparing')}>Start</button>
                        )}
                        {item.status === 'preparing' && (
                          <button className="btn btn-sm btn-success" onClick={() => updateItemStatus(kot._id, item._id, 'completed')}><FiCheck /></button>
                        )}
                        {item.status === 'completed' && <FiCheck className="text-success" />}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="kot-footer">
                  {kot.status === 'pending' && (
                    <button className="btn btn-primary btn-sm" onClick={() => updateKotStatus(kot._id, 'acknowledged')}>Acknowledge</button>
                  )}
                  {kot.status === 'acknowledged' && (
                    <button className="btn btn-warning btn-sm" onClick={() => updateKotStatus(kot._id, 'preparing')}>Start All</button>
                  )}
                  {kot.status === 'preparing' && (
                    <button className="btn btn-success btn-sm" onClick={() => updateKotStatus(kot._id, 'completed')}><FiCheck /> Complete All</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KitchenKOT;

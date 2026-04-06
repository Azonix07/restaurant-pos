import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { FiClock, FiCheck, FiPrinter, FiAlertCircle, FiEdit2, FiX, FiMinus, FiPlus, FiLock } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './KitchenKOT.css';

const KitchenKOT = () => {
  const [kots, setKots] = useState([]);
  const [section, setSection] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null); // { kotId, itemId, quantity }
  const [pinModal, setPinModal] = useState(null); // { action, kotId, itemId, ... }
  const [pin, setPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false); // stays true for the session

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

  const verifyPinAndExecute = async (action) => {
    if (pinVerified) {
      executePinAction(action);
      return;
    }
    setPinModal(action);
    setPin('');
  };

  const handlePinSubmit = async () => {
    try {
      await api.post('/auth/verify-pin', { pin });
      setPinVerified(true);
      toast.success('PIN verified');
      executePinAction(pinModal);
      setPinModal(null);
      setPin('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid PIN');
      setPin('');
    }
  };

  const executePinAction = (action) => {
    if (!action) return;
    if (action.type === 'edit') {
      setEditingItem({ kotId: action.kotId, itemId: action.itemId, quantity: action.quantity });
    } else if (action.type === 'cancelItem') {
      doCancelItem(action.kotId, action.itemId);
    } else if (action.type === 'cancelKOT') {
      doCancelKOT(action.kotId);
    }
  };

  const editItemQuantity = async (kotId, itemId, quantity) => {
    try {
      await api.patch(`/kot/${kotId}/edit-item`, { itemId, quantity });
      toast.success('Quantity updated');
      setEditingItem(null);
      fetchKots();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to edit'); }
  };

  const cancelItem = (kotId, itemId) => {
    verifyPinAndExecute({ type: 'cancelItem', kotId, itemId });
  };

  const doCancelItem = async (kotId, itemId) => {
    if (!window.confirm('Cancel this item?')) return;
    try {
      await api.patch(`/kot/${kotId}/cancel-item`, { itemId, reason: 'Cancelled from kitchen' });
      toast.success('Item cancelled');
      fetchKots();
    } catch (err) { toast.error('Failed to cancel item'); }
  };

  const cancelKOT = (kotId) => {
    verifyPinAndExecute({ type: 'cancelKOT', kotId });
  };

  const doCancelKOT = async (kotId) => {
    if (!window.confirm('Cancel entire KOT?')) return;
    try {
      await api.patch(`/kot/${kotId}/cancel`, { reason: 'Cancelled from kitchen' });
      toast.success('KOT cancelled');
      fetchKots();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to cancel KOT'); }
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
                  <div className="flex gap-8" style={{ alignItems: 'center' }}>
                    <span className={`badge badge-${kot.section}`}>{kot.section.toUpperCase()}</span>
                    {kot.status !== 'completed' && kot.status !== 'cancelled' && (
                      <button className="btn btn-sm btn-danger" onClick={() => cancelKOT(kot._id)} title="Cancel KOT">
                        <FiX />
                      </button>
                    )}
                  </div>
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
                        {editingItem && editingItem.kotId === kot._id && editingItem.itemId === item._id ? (
                          <div className="kot-edit-qty">
                            <button className="qty-btn-sm" onClick={() => setEditingItem({ ...editingItem, quantity: Math.max(1, editingItem.quantity - 1) })}><FiMinus size={12} /></button>
                            <span className="kot-item-qty">{editingItem.quantity}x</span>
                            <button className="qty-btn-sm" onClick={() => setEditingItem({ ...editingItem, quantity: editingItem.quantity + 1 })}><FiPlus size={12} /></button>
                            <button className="btn btn-sm btn-success" onClick={() => editItemQuantity(kot._id, item._id, editingItem.quantity)}><FiCheck size={12} /></button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditingItem(null)}><FiX size={12} /></button>
                          </div>
                        ) : (
                          <>
                            <span className="kot-item-qty">{item.quantity}x</span>
                            <span className="kot-item-name">{item.name}</span>
                            {item.notes && <span className="kot-item-notes">{item.notes}</span>}
                          </>
                        )}
                      </div>
                      <div className="kot-item-actions">
                        {item.status === 'pending' && (
                          <>
                            <button className="btn btn-sm btn-secondary" onClick={() => verifyPinAndExecute({ type: 'edit', kotId: kot._id, itemId: item._id, quantity: item.quantity })} title="Edit quantity"><FiEdit2 size={12} /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => cancelItem(kot._id, item._id)} title="Cancel item"><FiX size={12} /></button>
                            <button className="btn btn-sm btn-warning" onClick={() => updateItemStatus(kot._id, item._id, 'preparing')}>Start</button>
                          </>
                        )}
                        {item.status === 'preparing' && (
                          <>
                            <button className="btn btn-sm btn-danger" onClick={() => cancelItem(kot._id, item._id)} title="Cancel item"><FiX size={12} /></button>
                            <button className="btn btn-sm btn-success" onClick={() => updateItemStatus(kot._id, item._id, 'completed')}><FiCheck /></button>
                          </>
                        )}
                        {item.status === 'completed' && <FiCheck className="text-success" />}
                        {item.status === 'cancelled' && <span style={{ color: 'var(--danger)', fontSize: 12 }}>Cancelled</span>}
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

      {/* PIN Verification Modal */}
      {pinModal && (
        <div className="modal-overlay" onClick={() => setPinModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="flex-between mb-16">
              <h3><FiLock style={{ marginRight: 8 }} />Manager PIN Required</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setPinModal(null)}><FiX /></button>
            </div>
            <p className="text-secondary mb-16">Enter admin/manager PIN to authorize this action</p>
            <input
              type="password"
              className="input mb-16"
              placeholder="Enter 4-digit PIN"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && pin.length === 4 && handlePinSubmit()}
              autoFocus
            />
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handlePinSubmit} disabled={pin.length !== 4}>
              Verify & Proceed
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenKOT;

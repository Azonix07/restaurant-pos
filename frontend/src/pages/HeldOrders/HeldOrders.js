import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { FiPause, FiPlay, FiTrash2, FiClock, FiSearch } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './HeldOrders.css';

const HeldOrders = () => {
  const [heldOrders, setHeldOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchHeld = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/hold');
      setHeldOrders(res.data.heldOrders || []);
    } catch {
      toast.error('Failed to load held orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHeld(); }, [fetchHeld]);
  useSocket('order:held', fetchHeld);
  useSocket('order:resumed', fetchHeld);

  const handleResume = async (id) => {
    try {
      const res = await api.post(`/hold/${id}/resume`);
      toast.success(`Order resumed — #${res.data.order?.orderNumber || ''}`);
      fetchHeld();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resume');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this held order?')) return;
    try {
      await api.delete(`/hold/${id}`);
      toast.success('Held order cancelled');
      fetchHeld();
    } catch {
      toast.error('Failed to cancel');
    }
  };

  const timeRemaining = (expiresAt) => {
    const ms = new Date(expiresAt) - Date.now();
    if (ms <= 0) return 'Expired';
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hrs}h ${mins}m left`;
  };

  const filtered = heldOrders.filter(h =>
    !search ||
    h.holdNumber?.toLowerCase().includes(search.toLowerCase()) ||
    h.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    h.holdReason?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="held-orders-page">
      <div className="page-header">
        <h1><FiPause /> Held Orders</h1>
        <span className="held-count">{heldOrders.length} held</span>
      </div>

      <div className="held-search">
        <FiSearch />
        <input
          type="text"
          placeholder="Search held orders..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
        />
      </div>

      {loading ? (
        <div className="text-center" style={{ padding: 40 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FiPause size={48} />
          <p>No held orders</p>
        </div>
      ) : (
        <div className="held-grid">
          {filtered.map(order => (
            <div key={order._id} className={`held-card ${new Date(order.expiresAt) < Date.now() ? 'expired' : ''}`}>
              <div className="held-card-header">
                <strong>{order.holdNumber}</strong>
                <span className="held-timer">
                  <FiClock /> {timeRemaining(order.expiresAt)}
                </span>
              </div>

              <div className="held-card-body">
                {order.table && (
                  <div className="held-info">Table: <strong>{order.table?.name || order.table}</strong></div>
                )}
                {order.customerName && (
                  <div className="held-info">Customer: <strong>{order.customerName}</strong></div>
                )}
                {order.holdReason && (
                  <div className="held-info reason">{order.holdReason}</div>
                )}

                <div className="held-items">
                  {order.items?.slice(0, 5).map((item, i) => (
                    <div key={i} className="held-item">
                      <span>{item.name} × {item.quantity}</span>
                      <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  {order.items?.length > 5 && (
                    <div className="held-item more">+{order.items.length - 5} more items</div>
                  )}
                </div>

                <div className="held-total">
                  Total: <strong>₹{order.subtotal?.toFixed(2)}</strong>
                </div>
              </div>

              <div className="held-card-actions">
                <button className="btn btn-primary btn-sm" onClick={() => handleResume(order._id)}>
                  <FiPlay /> Resume
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleCancel(order._id)}>
                  <FiTrash2 /> Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeldOrders;

import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { toast } from 'react-toastify';
import './Kitchen.css';

const Kitchen = () => {
  const [orders, setOrders] = useState([]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/orders/kitchen');
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useSocket('order:new', () => fetchOrders());
  useSocket('order:update', () => fetchOrders());
  useSocket('kitchen:update', () => fetchOrders());
  useSocket('order:statusChange', () => fetchOrders());

  const updateItemStatus = async (orderId, itemId, status) => {
    try {
      await api.patch(`/orders/${orderId}/item-status`, { itemId, status });
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update item');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success(`Order marked ${status}`);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update order');
    }
  };

  const getTimeSince = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
  };

  const getTimeClass = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff > 30) return 'time-critical';
    if (diff > 15) return 'time-warning';
    return 'time-ok';
  };

  return (
    <div className="kitchen-page">
      <div className="page-header">
        <h1>🍳 Kitchen Display</h1>
        <span className="text-secondary">{orders.length} active orders</span>
      </div>

      {orders.length === 0 ? (
        <div className="card text-center" style={{ padding: '80px 20px' }}>
          <h2 style={{ color: 'var(--text-secondary)' }}>No pending orders</h2>
          <p className="text-secondary">New orders will appear here automatically</p>
        </div>
      ) : (
        <div className="kitchen-grid">
          {orders.map(order => (
            <div key={order._id} className={`kitchen-card ${getTimeClass(order.createdAt)}`}>
              <div className="kitchen-card-header">
                <div>
                  <strong className="kitchen-order-num">{order.orderNumber}</strong>
                  {order.tableNumber && <span className="kitchen-table">Table {order.tableNumber}</span>}
                </div>
                <div className="kitchen-time">
                  <span className={`time-badge ${getTimeClass(order.createdAt)}`}>
                    {getTimeSince(order.createdAt)}
                  </span>
                </div>
              </div>

              <div className="kitchen-items">
                {order.items?.map(item => (
                  <div key={item._id} className={`kitchen-item ${item.status}`}>
                    <div className="kitchen-item-info">
                      <span className="kitchen-item-qty">{item.quantity}x</span>
                      <span className="kitchen-item-name">{item.name}</span>
                      {item.notes && <span className="kitchen-item-notes">{item.notes}</span>}
                    </div>
                    <div className="kitchen-item-actions">
                      {item.status === 'placed' && (
                        <button className="btn btn-sm btn-warning" onClick={() => updateItemStatus(order._id, item._id, 'preparing')}>
                          Start
                        </button>
                      )}
                      {item.status === 'preparing' && (
                        <button className="btn btn-sm btn-success" onClick={() => updateItemStatus(order._id, item._id, 'ready')}>
                          Ready
                        </button>
                      )}
                      {item.status === 'ready' && (
                        <span className="badge badge-ready">✓ Ready</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="kitchen-card-footer">
                {order.status === 'placed' && (
                  <button className="btn btn-primary btn-sm" onClick={() => updateOrderStatus(order._id, 'confirmed')}>
                    Confirm Order
                  </button>
                )}
                {order.items?.every(i => i.status === 'ready') && (
                  <button className="btn btn-success" onClick={() => updateOrderStatus(order._id, 'ready')}>
                    Order Ready
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Kitchen;

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { toast } from 'react-toastify';
import './ExternalOrders.css';

const ExternalOrders = () => {
  const [orders, setOrders] = useState([]);
  const [platform, setPlatform] = useState('');

  const fetchOrders = async () => {
    try {
      const params = platform ? `?platform=${platform}` : '';
      const res = await api.get(`/external${params}`);
      setOrders(res.data.orders || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchOrders(); }, [platform]);
  useSocket('external:order', () => fetchOrders());

  const simulateOrder = async (plat) => {
    try {
      await api.post('/external/simulate', { platform: plat });
      toast.success(`${plat} order simulated!`);
      fetchOrders();
    } catch (err) { toast.error('Failed to simulate'); }
  };

  const updateStatus = async (orderId, status) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success(`Order ${status}`);
      fetchOrders();
    } catch (err) { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <h1>External Orders</h1>
        <div className="flex gap-8">
          <button className="btn btn-warning" onClick={() => simulateOrder('swiggy')}>
            🟠 Simulate Swiggy
          </button>
          <button className="btn btn-danger" onClick={() => simulateOrder('zomato')}>
            🔴 Simulate Zomato
          </button>
        </div>
      </div>

      <div className="flex gap-8 mb-24">
        <button className={`btn ${!platform ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPlatform('')}>All</button>
        <button className={`btn ${platform === 'swiggy' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPlatform('swiggy')}>Swiggy</button>
        <button className={`btn ${platform === 'zomato' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPlatform('zomato')}>Zomato</button>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Platform</th>
              <th>External ID</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order._id}>
                <td>{order.orderNumber}</td>
                <td><span className={`platform-badge ${order.externalPlatform}`}>{order.externalPlatform}</span></td>
                <td style={{ fontSize: '12px' }}>{order.externalOrderId}</td>
                <td>{order.items?.length} items</td>
                <td>₹{order.total?.toFixed(2)}</td>
                <td><span className={`badge badge-${order.status}`}>{order.status}</span></td>
                <td>{new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>
                  {order.status === 'placed' && (
                    <button className="btn btn-primary btn-sm" onClick={() => updateStatus(order._id, 'confirmed')}>Accept</button>
                  )}
                  {order.status === 'confirmed' && (
                    <button className="btn btn-warning btn-sm" onClick={() => updateStatus(order._id, 'preparing')}>Prepare</button>
                  )}
                  {order.status === 'preparing' && (
                    <button className="btn btn-success btn-sm" onClick={() => updateStatus(order._id, 'ready')}>Ready</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExternalOrders;

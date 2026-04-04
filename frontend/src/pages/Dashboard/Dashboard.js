import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { FiShoppingCart, FiDollarSign, FiUsers, FiTrendingUp } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [summaryRes, ordersRes] = await Promise.all([
        api.get('/reports/daily'),
        api.get('/orders/active'),
      ]);
      setSummary(summaryRes.data);
      setRecentOrders(ordersRes.data.orders?.slice(0, 10) || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useSocket('order:new', () => fetchData());
  useSocket('order:statusChange', () => fetchData());

  if (loading) return <div className="text-center mt-16">Loading dashboard...</div>;

  const paymentData = summary ? Object.entries(summary.paymentBreakdown || {}).map(([name, value]) => ({
    name: name.toUpperCase(), value,
  })).filter(d => d.value > 0) : [];

  const orderTypeData = summary ? Object.entries(summary.orderTypeBreakdown || {}).map(([name, value]) => ({
    name: name.replace('_', ' ').toUpperCase(), value,
  })).filter(d => d.value > 0) : [];

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <span className="text-secondary">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>

      <div className="grid-4 mb-24">
        <div className="stat-card">
          <FiShoppingCart className="stat-icon" style={{ color: 'var(--accent)' }} />
          <div className="stat-value">{summary?.totalOrders || 0}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        <div className="stat-card">
          <FiDollarSign className="stat-icon" style={{ color: 'var(--success)' }} />
          <div className="stat-value">₹{(summary?.totalSales || 0).toLocaleString('en-IN')}</div>
          <div className="stat-label">Total Sales</div>
        </div>
        <div className="stat-card">
          <FiTrendingUp className="stat-icon" style={{ color: 'var(--warning)' }} />
          <div className="stat-value">₹{(summary?.totalGST || 0).toLocaleString('en-IN')}</div>
          <div className="stat-label">GST Collected</div>
        </div>
        <div className="stat-card">
          <FiUsers className="stat-icon" style={{ color: 'var(--info)' }} />
          <div className="stat-value">₹{(summary?.profit || 0).toLocaleString('en-IN')}</div>
          <div className="stat-label">Net Profit</div>
        </div>
      </div>

      <div className="grid-2 mb-24">
        <div className="card">
          <h3 className="mb-16">Payment Methods</h3>
          {paymentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ₹${value}`}>
                  {paymentData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(val) => `₹${val}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-secondary text-center">No payment data yet</p>}
        </div>

        <div className="card">
          <h3 className="mb-16">Order Types</h3>
          {orderTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={orderTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-secondary text-center">No order data yet</p>}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-16">Active Orders</h3>
        {recentOrders.length === 0 ? (
          <p className="text-secondary text-center">No active orders</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Table</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr key={order._id}>
                    <td>{order.orderNumber}</td>
                    <td>{order.tableNumber || 'N/A'}</td>
                    <td>{order.items?.length || 0} items</td>
                    <td>₹{order.total?.toFixed(2)}</td>
                    <td><span className={`badge badge-${order.status}`}>{order.status}</span></td>
                    <td>{new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { FiShoppingCart, FiDollarSign, FiUsers, FiTrendingUp, FiClock, FiAlertTriangle, FiZap, FiToggleLeft, FiToggleRight, FiPackage, FiInfo } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'react-toastify';
import './Dashboard.css';

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [counterSession, setCounterSession] = useState(null);
  const [fraudAlerts, setFraudAlerts] = useState(null);
  const [smartAlerts, setSmartAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { hasRole } = useAuth();
  const { isRushMode, fetchSettings } = useSettings();

  const fetchData = async () => {
    try {
      const [summaryRes, ordersRes, counterRes] = await Promise.all([
        api.get('/reports/daily'),
        api.get('/orders/active'),
        api.get('/counter/current'),
      ]);
      setSummary(summaryRes.data);
      setRecentOrders(ordersRes.data.orders?.slice(0, 10) || []);
      setCounterSession(counterRes.data.session);

      // Fetch fraud alerts (non-blocking)
      try {
        const alertRes = await api.get('/fraud/alerts');
        setFraudAlerts(alertRes.data);
      } catch { /* ignore if not available */ }

      // Fetch smart alerts (non-blocking)
      try {
        const smartRes = await api.get('/settings/smart-alerts');
        setSmartAlerts(smartRes.data.alerts || []);
      } catch { /* ignore */ }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useSocket('order:new', () => fetchData());
  useSocket('order:statusChange', () => fetchData());

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner" />
      <p>Loading dashboard...</p>
    </div>
  );

  const paymentData = summary ? Object.entries(summary.paymentBreakdown || {}).map(([name, value]) => ({
    name: name.toUpperCase(), value,
  })).filter(d => d.value > 0) : [];

  const orderTypeData = summary ? Object.entries(summary.orderTypeBreakdown || {}).map(([name, value]) => ({
    name: name.replace('_', ' ').toUpperCase(), value,
  })).filter(d => d.value > 0) : [];

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

  const toggleRushMode = async () => {
    try {
      const res = await api.post('/settings/rush-mode/toggle');
      toast.success(res.data.message);
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const alertIcon = (type) => ({
    low_stock: <FiPackage className="alert-icon-warning" />,
    low_raw_material: <FiPackage className="alert-icon-danger" />,
    no_sales: <FiInfo className="alert-icon-muted" />,
    top_selling: <FiTrendingUp className="alert-icon-success" />,
    dead_stock: <FiAlertTriangle className="alert-icon-warning" />,
  }[type] || <FiInfo />);

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="flex gap-16" style={{ alignItems: 'center' }}>
          {hasRole('admin', 'manager') && (
            <button className={`rush-toggle ${isRushMode ? 'active' : ''}`} onClick={toggleRushMode}>
              <FiZap /> {isRushMode ? 'Disable' : 'Enable'} Rush Mode
            </button>
          )}
          <span className="text-secondary">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
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

      {/* Counter Session & Fraud Alerts */}
      <div className="grid-2 mb-24">
        <div className="card">
          <h3 className="mb-12"><FiClock className="dashboard-inline-icon" />Counter Status</h3>
          {counterSession ? (
            <div>
              <div className="dashboard-counter-badge">● Open — Shift #{counterSession.shiftNumber}</div>
              <div className="dashboard-counter-grid">
                <div><span className="text-secondary">Opening Cash:</span> ₹{counterSession.openingCash?.toLocaleString('en-IN')}</div>
                <div><span className="text-secondary">Cash Sales:</span> ₹{(counterSession.systemCash || 0).toLocaleString('en-IN')}</div>
                <div><span className="text-secondary">Total Sales:</span> ₹{(counterSession.systemTotal || 0).toLocaleString('en-IN')}</div>
                <div><span className="text-secondary">Orders:</span> {counterSession.totalOrders || 0}</div>
              </div>
              <p className="dashboard-counter-meta">Opened by {counterSession.openedBy?.name} at {new Date(counterSession.openedAt).toLocaleTimeString('en-IN')}</p>
            </div>
          ) : (
             <div className="dashboard-counter-closed">
               <p className="dashboard-counter-closed-title">Counter is Closed</p>
               <p className="text-secondary dashboard-counter-hint">Go to Counter & Shifts to open a new session</p>
            </div>
          )}
        </div>

        {fraudAlerts && fraudAlerts.totalAlerts > 0 ? (
          <div className="card dashboard-fraud-card" style={{ borderLeft: `4px solid ${fraudAlerts.criticalCount > 0 ? 'var(--danger)' : 'var(--warning)'}` }}>
            <h3 className="mb-12"><FiAlertTriangle className="dashboard-inline-icon text-danger" />Fraud Alerts</h3>
            <div className="dashboard-alert-counts">
              <span className="dashboard-alert-critical">{fraudAlerts.criticalCount} Critical</span>
              <span className="dashboard-alert-warning">{fraudAlerts.warningCount} Warnings</span>
            </div>
            {fraudAlerts.alerts?.slice(0, 3).map((a, i) => (
              <p key={i} className={`dashboard-alert-msg ${a.severity === 'critical' ? 'critical' : ''}`}>• {a.message}</p>
            ))}
          </div>
        ) : (
          <div className="card">
            <h3 className="mb-12"><FiAlertTriangle className="dashboard-inline-icon" />System Status</h3>
            <div className="dashboard-all-clear">
              <p className="dashboard-all-clear-title">✓ All Clear</p>
              <p className="text-secondary dashboard-counter-hint">No fraud alerts today</p>
            </div>
          </div>
        )}
      </div>

      {/* Smart Alerts */}
      {smartAlerts.length > 0 && (
        <div className="smart-alerts mb-24">
          {smartAlerts.map((alert, i) => (
            <div key={i} className={`smart-alert smart-alert-${alert.severity}`}>
              <div className="smart-alert-header">
                {alertIcon(alert.type)}
                <strong>{alert.title}</strong>
              </div>
              {alert.items?.length > 0 && (
                <div className="smart-alert-items">
                  {alert.items.slice(0, 3).map((item, j) => (
                    <span key={j} className="smart-alert-item">• {item}</span>
                  ))}
                  {alert.items.length > 3 && <span className="smart-alert-item text-secondary">+{alert.items.length - 3} more</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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

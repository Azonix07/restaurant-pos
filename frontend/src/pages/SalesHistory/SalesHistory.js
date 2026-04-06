import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './SalesHistory.css';

const SalesHistory = () => {
  const [data, setData] = useState({ orders: [], summary: {}, totalPages: 1 });
  const [staff, setStaff] = useState([]);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    staff: '',
    paymentMethod: '',
    type: '',
    page: 1,
    limit: 25,
  });

  useEffect(() => {
    api.get('/auth/users').then(res => setStaff(res.data.users || [])).catch(() => {});
  }, []);

  const fetchSales = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.staff) params.append('staff', filters.staff);
      if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
      if (filters.type) params.append('type', filters.type);
      params.append('page', filters.page);
      params.append('limit', filters.limit);
      const res = await api.get(`/orders/sales-history?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load sales history');
    }
  }, [filters]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: key === 'page' ? value : 1 }));
  };

  const s = data.summary || {};

  return (
    <div className="sales-history-page">
      <div className="page-header">
        <h1>Sales History</h1>
      </div>

      <div className="sh-filters mb-24">
        <input type="date" className="input" value={filters.startDate} onChange={e => updateFilter('startDate', e.target.value)} />
        <input type="date" className="input" value={filters.endDate} onChange={e => updateFilter('endDate', e.target.value)} />
        <select className="input" value={filters.staff} onChange={e => updateFilter('staff', e.target.value)}>
          <option value="">All Staff</option>
          {staff.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
        </select>
        <select className="input" value={filters.paymentMethod} onChange={e => updateFilter('paymentMethod', e.target.value)}>
          <option value="">All Payments</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="upi">UPI</option>
          <option value="company">Company</option>
        </select>
        <select className="input" value={filters.type} onChange={e => updateFilter('type', e.target.value)}>
          <option value="">All Types</option>
          <option value="dine_in">Dine-In</option>
          <option value="takeaway">Takeaway</option>
          <option value="delivery">Delivery</option>
        </select>
      </div>

      <div className="grid-4 mb-24">
        <div className="stat-card"><div className="stat-label">Total Sales</div><div className="stat-value">₹{(s.totalSales || 0).toLocaleString('en-IN')}</div></div>
        <div className="stat-card"><div className="stat-label">Orders</div><div className="stat-value">{s.orderCount || 0}</div></div>
        <div className="stat-card"><div className="stat-label">Avg Order Value</div><div className="stat-value">₹{(s.avgOrderValue || 0).toFixed(2)}</div></div>
        <div className="stat-card"><div className="stat-label">Cash Sales</div><div className="stat-value">₹{(s.cashSales || 0).toLocaleString('en-IN')}</div></div>
      </div>
      <div className="grid-3 mb-24">
        <div className="stat-card"><div className="stat-label">Card Sales</div><div className="stat-value">₹{(s.cardSales || 0).toLocaleString('en-IN')}</div></div>
        <div className="stat-card"><div className="stat-label">UPI Sales</div><div className="stat-value">₹{(s.upiSales || 0).toLocaleString('en-IN')}</div></div>
        <div className="stat-card"><div className="stat-label">Company Sales</div><div className="stat-value">₹{(s.companySales || 0).toLocaleString('en-IN')}</div></div>
      </div>

      <div className="card">
        <table className="sh-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Table</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Staff</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {(data.orders || []).map(order => (
              <tr key={order._id}>
                <td>{order.orderNumber}</td>
                <td>{order.table?.name || '—'}</td>
                <td>₹{(order.totalAmount || 0).toLocaleString('en-IN')}</td>
                <td><span className={`badge badge-${order.paymentMethod}`}>{order.paymentMethod}</span></td>
                <td>{order.staff?.name || '—'}</td>
                <td>{new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
              </tr>
            ))}
            {data.orders?.length === 0 && (
              <tr><td colSpan="6" className="text-center text-secondary" style={{ padding: 40 }}>No orders found</td></tr>
            )}
          </tbody>
        </table>

        <div className="sh-pagination">
          <button className="btn btn-sm btn-secondary" disabled={filters.page <= 1} onClick={() => updateFilter('page', filters.page - 1)}><FiChevronLeft /></button>
          <span className="text-secondary">Page {filters.page} of {data.totalPages || 1}</span>
          <button className="btn btn-sm btn-secondary" disabled={filters.page >= (data.totalPages || 1)} onClick={() => updateFilter('page', filters.page + 1)}><FiChevronRight /></button>
        </div>
      </div>
    </div>
  );
};

export default SalesHistory;

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { FiDownload } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Reports.css';

const downloadExport = async (url, filename) => {
  try {
    const res = await api.get(url, { responseType: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(res.data);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Downloaded ' + filename);
  } catch (err) { toast.error('Export failed'); }
};

const Reports = () => {
  const [activeTab, setActiveTab] = useState('daily');
  const [dailySummary, setDailySummary] = useState(null);
  const [salesReport, setSalesReport] = useState([]);
  const [itemReport, setItemReport] = useState([]);
  const [taxReport, setTaxReport] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (activeTab === 'daily') fetchDaily();
    else if (activeTab === 'sales') fetchSales();
    else if (activeTab === 'items') fetchItems();
    else if (activeTab === 'tax') fetchTax();
  }, [activeTab, dateRange]);

  const fetchDaily = async () => {
    try {
      const res = await api.get('/reports/daily');
      setDailySummary(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchSales = async () => {
    try {
      const res = await api.get(`/reports/sales?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      setSalesReport(res.data.report || []);
    } catch (err) { console.error(err); }
  };

  const fetchItems = async () => {
    try {
      const res = await api.get(`/reports/items?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      setItemReport(res.data.report || []);
    } catch (err) { console.error(err); }
  };

  const fetchTax = async () => {
    try {
      const res = await api.get(`/reports/tax?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      setTaxReport(res.data);
    } catch (err) { console.error(err); }
  };

  const tabs = [
    { id: 'daily', label: 'Daily Summary' },
    { id: 'sales', label: 'Sales Report' },
    { id: 'items', label: 'Item-wise Sales' },
    { id: 'tax', label: 'Tax Report' },
  ];

  const exportMap = {
    daily: { pdf: `/export/reports/daily/pdf?date=${dateRange.startDate}`, excel: `/export/reports/daily/excel?date=${dateRange.startDate}`, name: 'daily-summary' },
    sales: { pdf: `/export/reports/sales/pdf?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, excel: `/export/reports/sales/excel?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, name: 'sales-report' },
    items: { pdf: `/export/reports/items/pdf?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, excel: `/export/reports/items/excel?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, name: 'item-sales' },
    tax: { pdf: `/export/reports/tax/pdf?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, excel: `/export/reports/tax/excel?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, name: 'tax-report' },
  };

  return (
    <div>
      <div className="page-header">
        <h1>Reports</h1>
        <div className="flex gap-8">
          {activeTab !== 'daily' && (
            <>
              <input type="date" className="input" style={{ width: 'auto' }} value={dateRange.startDate} onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))} />
              <input type="date" className="input" style={{ width: 'auto' }} value={dateRange.endDate} onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))} />
            </>
          )}
          <button className="btn btn-secondary" onClick={() => downloadExport(exportMap[activeTab].pdf, exportMap[activeTab].name + '.pdf')}><FiDownload /> PDF</button>
          <button className="btn btn-success" onClick={() => downloadExport(exportMap[activeTab].excel, exportMap[activeTab].name + '.xlsx')}><FiDownload /> Excel</button>
        </div>
      </div>

      <div className="report-tabs mb-24">
        {tabs.map(tab => (
          <button key={tab.id} className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'daily' && dailySummary && (
        <div>
          <div className="grid-4 mb-24">
            <div className="stat-card"><div className="stat-label">Orders</div><div className="stat-value">{dailySummary.totalOrders}</div></div>
            <div className="stat-card"><div className="stat-label">Sales</div><div className="stat-value">₹{dailySummary.totalSales?.toLocaleString('en-IN')}</div></div>
            <div className="stat-card"><div className="stat-label">GST</div><div className="stat-value">₹{dailySummary.totalGST?.toLocaleString('en-IN')}</div></div>
            <div className="stat-card"><div className="stat-label">Profit</div><div className="stat-value" style={{ color: dailySummary.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>₹{dailySummary.profit?.toLocaleString('en-IN')}</div></div>
          </div>
          <div className="grid-2">
            <div className="card">
              <h3 className="mb-8">Payment Breakdown</h3>
              {Object.entries(dailySummary.paymentBreakdown || {}).map(([m, v]) => (
                <div key={m} className="flex-between mb-8"><span className="text-secondary">{m.toUpperCase()}</span><strong>₹{v?.toLocaleString('en-IN')}</strong></div>
              ))}
            </div>
            <div className="card">
              <h3 className="mb-8">Order Types</h3>
              {Object.entries(dailySummary.orderTypeBreakdown || {}).map(([t, c]) => (
                <div key={t} className="flex-between mb-8"><span className="text-secondary">{t.replace('_', ' ').toUpperCase()}</span><strong>{c}</strong></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sales' && (
        <div className="card">
          <h3 className="mb-16">Sales Trend</h3>
          {salesReport.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={salesReport}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="_id" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip formatter={(val) => `₹${val?.toFixed(2)}`} />
                <Line type="monotone" dataKey="totalSales" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-secondary text-center">No data for selected period</p>}
        </div>
      )}

      {activeTab === 'items' && (
        <div className="card">
          <h3 className="mb-16">Item-wise Sales</h3>
          {itemReport.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={itemReport.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} />
                  <YAxis type="category" dataKey="_id" stroke="var(--text-secondary)" fontSize={12} width={150} />
                  <Tooltip formatter={(val) => `₹${val?.toFixed(2)}`} />
                  <Bar dataKey="totalRevenue" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <table className="data-table mt-16">
                <thead><tr><th>Item</th><th>Quantity</th><th>Revenue</th></tr></thead>
                <tbody>
                  {itemReport.map(item => (
                    <tr key={item._id}><td>{item._id}</td><td>{item.totalQuantity}</td><td>₹{item.totalRevenue?.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : <p className="text-secondary text-center">No data for selected period</p>}
        </div>
      )}

      {activeTab === 'tax' && taxReport && (
        <div className="card">
          <h3 className="mb-16">Tax Report</h3>
          <table className="data-table mb-16">
            <thead><tr><th>GST Rate</th><th>Taxable Amount</th><th>GST Collected</th></tr></thead>
            <tbody>
              {taxReport.report?.map(r => (
                <tr key={r._id}><td>{r._id}%</td><td>₹{r.taxableAmount?.toFixed(2)}</td><td>₹{r.gstCollected?.toFixed(2)}</td></tr>
              ))}
              <tr style={{ fontWeight: 'bold' }}><td>Total</td><td>₹{taxReport.totalTaxable?.toFixed(2)}</td><td>₹{taxReport.totalGST?.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Reports;

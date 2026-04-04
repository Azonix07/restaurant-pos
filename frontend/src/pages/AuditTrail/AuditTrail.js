import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiDownload, FiFilter } from 'react-icons/fi';
import { toast } from 'react-toastify';

const AuditTrail = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ module: '', action: '', startDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] });
  const [page, setPage] = useState(1);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 100, ...filters });
      const res = await api.get(`/audit?${params}`);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchLogs(); }, [filters, page]);

  const exportCSV = async () => {
    try {
      const res = await api.get(`/audit/export?startDate=${filters.startDate}&endDate=${filters.endDate}`);
      const blob = new Blob([res.data.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${filters.startDate}-to-${filters.endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.data.totalEntries} entries`);
    } catch (err) { toast.error('Export failed'); }
  };

  const modules = [...new Set(logs.map(l => l.module))];
  const actions = [...new Set(logs.map(l => l.action))];

  return (
    <div>
      <div className="page-header">
        <h1>Audit Trail</h1>
        <button className="btn btn-primary" onClick={exportCSV}><FiDownload /> Export for CA</button>
      </div>

      <div className="flex gap-8 mb-24" style={{ flexWrap: 'wrap' }}>
        <select className="input" style={{ width: 'auto' }} value={filters.module} onChange={e => setFilters({ ...filters, module: e.target.value })}>
          <option value="">All Modules</option>
          {modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })}>
          <option value="">All Actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" className="input" style={{ width: 'auto' }} value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
        <input type="date" className="input" style={{ width: 'auto' }} value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
      </div>

      <div className="card">
        <div className="flex-between mb-16"><h3>Activity Log</h3><span className="text-secondary">{total} entries</span></div>
        <table className="data-table">
          <thead><tr><th>Date/Time</th><th>User</th><th>Module</th><th>Action</th><th>Description</th></tr></thead>
          <tbody>
            {logs.map(log => (
              <tr key={log._id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {new Date(log.createdAt).toLocaleDateString('en-IN')}<br />
                  <span className="text-secondary">{new Date(log.createdAt).toLocaleTimeString('en-IN')}</span>
                </td>
                <td>{log.userName || log.user?.name || '-'}</td>
                <td><span className="badge badge-preparing">{log.module}</span></td>
                <td><span className={`badge ${log.action === 'delete' || log.action === 'cancel' ? 'badge-cancelled' : log.action === 'create' ? 'badge-completed' : 'badge-preparing'}`}>{log.action}</span></td>
                <td>{log.description || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan="5" className="text-center text-secondary">No audit logs</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditTrail;

import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { FiMonitor, FiWifi, FiWifiOff, FiLock, FiAlertTriangle, FiCheckCircle, FiRefreshCw, FiActivity } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Monitoring.css';

const Monitoring = () => {
  const [dashboard, setDashboard] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/monitoring/dashboard');
      setDashboard(res.data);
    } catch (err) { toast.error('Failed to load dashboard'); }
    setLoading(false);
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get('/monitoring/alerts?resolved=false');
      setAlerts(res.data.alerts);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchDashboard(); fetchAlerts(); }, [fetchDashboard, fetchAlerts]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => { fetchDashboard(); fetchAlerts(); }, 10000);
    return () => clearInterval(interval);
  }, [fetchDashboard, fetchAlerts]);

  useSocket('device:disconnected', () => { fetchDashboard(); fetchAlerts(); });
  useSocket('device:reconnected', () => fetchDashboard());
  useSocket('alert:new', (alert) => {
    setAlerts(prev => [alert, ...prev]);
    toast.warning(alert.title);
  });

  const resolveAlert = async (id) => {
    try {
      await api.patch(`/monitoring/alerts/${id}/resolve`, { resolution: 'Resolved from dashboard' });
      fetchAlerts();
      toast.success('Alert resolved');
    } catch (err) { toast.error('Failed to resolve'); }
  };

  const lockDevice = async (id) => {
    try {
      await api.patch(`/devices/${id}/lock`, { reason: 'Locked from monitoring dashboard' });
      fetchDashboard();
      toast.success('Device locked');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to lock'); }
  };

  const unlockDevice = async (id) => {
    try {
      await api.patch(`/devices/${id}/unlock`);
      fetchDashboard();
      toast.success('Device unlocked');
    } catch (err) { toast.error('Failed to unlock'); }
  };

  if (loading) return <div className="loading">Loading monitoring data...</div>;

  const d = dashboard;

  return (
    <div>
      <div className="page-header">
        <h1><FiActivity /> System Monitoring</h1>
        <button className="btn btn-secondary" onClick={() => { fetchDashboard(); fetchAlerts(); }}><FiRefreshCw /> Refresh</button>
      </div>

      <div className="report-tabs mb-24">
        {['overview', 'devices', 'alerts'].map(tab => (
          <button key={tab} className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'alerts' && alerts.length > 0 && <span className="alert-badge">{alerts.length}</span>}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && d && (
        <>
          <div className="grid-4 mb-24">
            <div className="stat-card"><div className="stat-label">Devices Online</div><div className="stat-value" style={{ color: 'var(--success)' }}>{d.summary.devicesOnline}</div></div>
            <div className="stat-card"><div className="stat-label">Devices Offline</div><div className="stat-value" style={{ color: d.summary.devicesOffline > 0 ? 'var(--danger)' : undefined }}>{d.summary.devicesOffline}</div></div>
            <div className="stat-card"><div className="stat-label">Today's Orders</div><div className="stat-value">{d.summary.todayOrders}</div></div>
            <div className="stat-card"><div className="stat-label">Today's Sales</div><div className="stat-value">₹{d.summary.todaySales?.toLocaleString()}</div></div>
          </div>
          <div className="grid-3 mb-24">
            <div className="stat-card"><div className="stat-label">Pending KOTs</div><div className="stat-value">{d.summary.pendingKOTs}</div></div>
            <div className="stat-card"><div className="stat-label">Bill Gaps</div><div className="stat-value" style={{ color: d.summary.billGaps > 0 ? 'var(--danger)' : 'var(--success)' }}>{d.summary.billGaps > 0 ? `${d.summary.billGaps} GAPS!` : 'None'}</div></div>
            <div className="stat-card"><div className="stat-label">No Sales Alert</div><div className="stat-value" style={{ color: d.summary.noSalesAlert ? 'var(--danger)' : 'var(--success)' }}>{d.summary.noSalesAlert ? 'WARNING' : 'OK'}</div></div>
          </div>

          {d.activeAlerts?.length > 0 && (
            <div className="card mb-24">
              <h3 className="mb-16"><FiAlertTriangle style={{ color: 'var(--danger)' }} /> Active Alerts ({d.activeAlerts.length})</h3>
              {d.activeAlerts.slice(0, 5).map(a => (
                <div key={a._id} className={`alert-item severity-${a.severity}`}>
                  <div><strong>{a.title}</strong><p className="text-secondary">{a.message}</p></div>
                  <button className="btn btn-sm btn-success" onClick={() => resolveAlert(a._id)}><FiCheckCircle /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'devices' && d && (
        <div className="card">
          <h3 className="mb-16">Device Status</h3>
          <table className="table">
            <thead>
              <tr><th>Device</th><th>Type</th><th>Status</th><th>IP</th><th>Last Heartbeat</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {d.devices?.map(dev => (
                <tr key={dev._id}>
                  <td><strong>{dev.name}</strong>{dev.isMaster && <span className="badge badge-primary ml-8">MASTER</span>}</td>
                  <td>{dev.type}</td>
                  <td>
                    {dev.status === 'online' ? <span className="badge badge-success"><FiWifi /> Online</span> :
                     dev.status === 'locked' ? <span className="badge badge-danger"><FiLock /> Locked</span> :
                     <span className="badge badge-secondary"><FiWifiOff /> Offline</span>}
                  </td>
                  <td>{dev.ipAddress || '-'}</td>
                  <td>{dev.lastHeartbeat ? new Date(dev.lastHeartbeat).toLocaleTimeString() : 'Never'}</td>
                  <td>
                    {!dev.isMaster && (
                      dev.status === 'locked' ?
                        <button className="btn btn-sm btn-success" onClick={() => unlockDevice(dev._id)}>Unlock</button> :
                        <button className="btn btn-sm btn-danger" onClick={() => lockDevice(dev._id)}>Lock</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="card">
          <h3 className="mb-16">Alert Log</h3>
          {alerts.length === 0 ? <p className="text-secondary">No active alerts.</p> :
            alerts.map(a => (
              <div key={a._id} className={`alert-item severity-${a.severity}`}>
                <div>
                  <div className="flex gap-8 mb-4">
                    <span className={`badge badge-${a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info'}`}>{a.severity}</span>
                    <span className="badge badge-secondary">{a.type}</span>
                  </div>
                  <strong>{a.title}</strong>
                  <p className="text-secondary">{a.message}</p>
                  <small className="text-secondary">{new Date(a.createdAt).toLocaleString()}</small>
                </div>
                <button className="btn btn-sm btn-success" onClick={() => resolveAlert(a._id)}><FiCheckCircle /> Resolve</button>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};

export default Monitoring;

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiShield, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import './FraudDashboard.css';

const FraudDashboard = () => {
  const [alerts, setAlerts] = useState(null);
  const [recon, setRecon] = useState(null);
  const [activeTab, setActiveTab] = useState('alerts');
  const [reconDate, setReconDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (activeTab === 'alerts') fetchAlerts();
    if (activeTab === 'recon') fetchRecon();
  }, [activeTab, reconDate]);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/fraud/alerts');
      setAlerts(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchRecon = async () => {
    try {
      const res = await api.get(`/fraud/reconciliation?date=${reconDate}`);
      setRecon(res.data);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="fraud-page">
      <div className="page-header">
        <h1><FiShield style={{ marginRight: 8 }} />Anti-Fraud Dashboard</h1>
        <div className="report-tabs">
          <button className={`btn ${activeTab === 'alerts' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('alerts')}>Live Alerts</button>
          <button className={`btn ${activeTab === 'recon' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('recon')}>Reconciliation</button>
        </div>
      </div>

      {activeTab === 'alerts' && (
        <div>
          {alerts && (
            <div className="grid-3 mb-24">
              <div className="stat-card"><div className="stat-label">Total Alerts</div><div className="stat-value">{alerts.totalAlerts}</div></div>
              <div className="stat-card"><div className="stat-label">Critical</div><div className="stat-value" style={{ color: 'var(--danger)' }}>{alerts.criticalCount}</div></div>
              <div className="stat-card"><div className="stat-label">Warnings</div><div className="stat-value" style={{ color: 'var(--warning)' }}>{alerts.warningCount}</div></div>
            </div>
          )}
          {alerts?.alerts?.length === 0 ? (
            <div className="card text-center" style={{ padding: 60 }}>
              <FiCheckCircle size={48} style={{ color: 'var(--success)', marginBottom: 12 }} />
              <h2 style={{ color: 'var(--success)' }}>All Clear</h2>
              <p className="text-secondary">No fraud alerts detected today</p>
            </div>
          ) : (
            alerts?.alerts?.map((alert, i) => (
              <div key={i} className={`alert-card ${alert.severity}`}>
                <div className="flex-between">
                  <span className="alert-type">{alert.severity === 'critical' ? <FiAlertTriangle style={{ marginRight: 4 }} /> : null}{alert.type.replace(/_/g, ' ')}</span>
                  <span className={`badge badge-${alert.severity === 'critical' ? 'cancelled' : 'placed'}`}>{alert.severity}</span>
                </div>
                <div className="alert-msg">{alert.message}</div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'recon' && (
        <div>
          <div className="flex gap-8 mb-24">
            <input type="date" className="input" style={{ width: 'auto' }} value={reconDate} onChange={e => setReconDate(e.target.value)} />
          </div>
          {recon ? (
            <div>
              <div className={`recon-status ${recon.isClean ? 'clean' : 'dirty'}`}>
                {recon.isClean ? '✓ Clean — No Issues Found' : '⚠ Issues Detected'}
              </div>
              <div className="grid-2">
                <div className="recon-card">
                  <h3 className="mb-12">Orders</h3>
                  <div className="flex-between mb-8"><span>Total Paid</span><strong>{recon.orders?.total}</strong></div>
                  <div className="flex-between mb-8"><span>Cancelled</span><strong style={{ color: 'var(--danger)' }}>{recon.orders?.cancelled}</strong></div>
                  <div className="flex-between mb-8"><span>Total Sales</span><strong>₹{recon.orders?.totalSales?.toLocaleString('en-IN')}</strong></div>
                  <div className="flex-between mb-8"><span>Total Discounts</span><strong>₹{recon.orders?.totalDiscount?.toFixed(2)}</strong></div>
                </div>
                <div className="recon-card">
                  <h3 className="mb-12">KOT vs Billing</h3>
                  <div className="flex-between mb-8"><span>Total KOTs</span><strong>{recon.kot?.totalKOTs}</strong></div>
                  <div className="flex-between mb-8"><span>KOT Items</span><strong>{recon.kot?.kotItemCount}</strong></div>
                  <div className="flex-between mb-8"><span>Billed Items</span><strong>{recon.kot?.orderItemCount}</strong></div>
                  <div className="flex-between mb-8"><span>Mismatch</span><strong style={{ color: recon.kot?.mismatch ? 'var(--danger)' : 'var(--success)' }}>{recon.kot?.mismatch ? 'YES' : 'No'}</strong></div>
                </div>
              </div>
              {recon.billGaps?.length > 0 && (
                <div className="card mt-16" style={{ borderLeft: '4px solid var(--danger)' }}>
                  <h4 style={{ color: 'var(--danger)' }}>Bill Number Gaps: {recon.billGaps.join(', ')}</h4>
                </div>
              )}
            </div>
          ) : (
            <div className="card text-center" style={{ padding: 40 }}><p className="text-secondary">Loading reconciliation...</p></div>
          )}
        </div>
      )}
    </div>
  );
};

export default FraudDashboard;

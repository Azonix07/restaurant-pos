import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiAlertTriangle, FiCheckCircle, FiShield } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './StaffAnalysis.css';

const StaffAnalysis = () => {
  const [analysis, setAnalysis] = useState(null);
  const [daily, setDaily] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => { fetchAnalysis(); fetchDaily(); }, [dateRange]);

  const fetchAnalysis = async () => {
    try {
      const res = await api.get(`/fraud/staff-analysis?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      setAnalysis(res.data);
    } catch (err) {
      toast.error('Failed to load staff analysis');
    }
  };

  const fetchDaily = async () => {
    try {
      const res = await api.get('/fraud/daily-summary');
      setDaily(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const riskColor = (level) => {
    if (level === 'high') return 'var(--danger)';
    if (level === 'medium') return 'var(--warning)';
    return 'var(--success)';
  };

  const riskBg = (level) => {
    if (level === 'high') return '#fef2f2';
    if (level === 'medium') return '#fffbeb';
    return '#ecfdf5';
  };

  return (
    <div className="staff-analysis-page">
      <div className="page-header">
        <h1><FiShield style={{ marginRight: 8 }} />Staff Analysis</h1>
        <div className="flex gap-8">
          <input type="date" className="input" style={{ width: 'auto' }} value={dateRange.startDate} onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))} />
          <input type="date" className="input" style={{ width: 'auto' }} value={dateRange.endDate} onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))} />
        </div>
      </div>

      {daily && (
        <div className="sa-risk-card mb-24" style={{ background: riskBg(daily.riskLevel), color: riskColor(daily.riskLevel), borderLeft: `4px solid ${riskColor(daily.riskLevel)}` }}>
          <div className="sa-risk-icon">
            {daily.riskLevel === 'high' ? <FiAlertTriangle size={32} /> : daily.riskLevel === 'medium' ? <FiAlertTriangle size={32} /> : <FiCheckCircle size={32} />}
          </div>
          <div>
            <div className="sa-risk-level">Daily Risk: {daily.riskLevel?.toUpperCase()}</div>
            <div className="sa-risk-detail">{daily.summary || `${daily.alertCount || 0} alerts today`}</div>
          </div>
        </div>
      )}

      {analysis && (
        <>
          {analysis.cancellations?.length > 0 && (
            <div className="card mb-24">
              <h3 className="sa-section-title">Staff Cancellations</h3>
              <table className="sa-table">
                <thead>
                  <tr><th>Staff</th><th>Cancellations</th><th>Total Value</th><th>Rate</th></tr>
                </thead>
                <tbody>
                  {analysis.cancellations.map((s, i) => (
                    <tr key={i}>
                      <td>{s.staffName || s.staff}</td>
                      <td>{s.count}</td>
                      <td>₹{(s.totalValue || 0).toLocaleString('en-IN')}</td>
                      <td><span className={`badge ${s.rate > 10 ? 'badge-cancelled' : 'badge-completed'}`}>{s.rate?.toFixed(1)}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {analysis.discounts?.length > 0 && (
            <div className="card mb-24">
              <h3 className="sa-section-title">Discount Analysis</h3>
              <table className="sa-table">
                <thead>
                  <tr><th>Staff</th><th>Discounts Given</th><th>Total Discount</th><th>Avg Discount %</th></tr>
                </thead>
                <tbody>
                  {analysis.discounts.map((s, i) => (
                    <tr key={i}>
                      <td>{s.staffName || s.staff}</td>
                      <td>{s.count}</td>
                      <td>₹{(s.totalDiscount || 0).toLocaleString('en-IN')}</td>
                      <td><span className={`badge ${s.avgPercent > 15 ? 'badge-cancelled' : 'badge-completed'}`}>{s.avgPercent?.toFixed(1)}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {analysis.quickVoids?.length > 0 && (
            <div className="card mb-24">
              <h3 className="sa-section-title">Quick Voids</h3>
              <table className="sa-table">
                <thead>
                  <tr><th>Staff</th><th>Order #</th><th>Amount</th><th>Time to Void</th></tr>
                </thead>
                <tbody>
                  {analysis.quickVoids.map((v, i) => (
                    <tr key={i}>
                      <td>{v.staffName || v.staff}</td>
                      <td>{v.orderNumber}</td>
                      <td>₹{(v.amount || 0).toLocaleString('en-IN')}</td>
                      <td>{v.timeToVoid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {analysis.alerts?.length > 0 && (
            <div className="card mb-24">
              <h3 className="sa-section-title">Staff Alerts</h3>
              {analysis.alerts.map((alert, i) => (
                <div key={i} className={`sa-alert ${alert.severity || 'warning'}`}>
                  <div className="flex-between">
                    <span className="sa-alert-type">
                      <FiAlertTriangle style={{ marginRight: 4 }} />
                      {alert.type?.replace(/_/g, ' ')}
                    </span>
                    <span className={`badge badge-${alert.severity === 'critical' ? 'cancelled' : 'placed'}`}>{alert.severity}</span>
                  </div>
                  <div className="sa-alert-msg">{alert.message}</div>
                </div>
              ))}
            </div>
          )}

          {!analysis.cancellations?.length && !analysis.discounts?.length && !analysis.quickVoids?.length && !analysis.alerts?.length && (
            <div className="card text-center" style={{ padding: 60 }}>
              <FiCheckCircle size={48} style={{ color: 'var(--success)', marginBottom: 12 }} />
              <h2 style={{ color: 'var(--success)' }}>All Clear</h2>
              <p className="text-secondary">No suspicious staff activity detected</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StaffAnalysis;

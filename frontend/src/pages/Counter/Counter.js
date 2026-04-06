import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { FiClock, FiDollarSign, FiCheck, FiAlertTriangle, FiDownload } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Counter.css';

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

const DENOMINATIONS = [
  { key: 'notes2000', label: '₹2000', value: 2000 },
  { key: 'notes500', label: '₹500', value: 500 },
  { key: 'notes200', label: '₹200', value: 200 },
  { key: 'notes100', label: '₹100', value: 100 },
  { key: 'notes50', label: '₹50', value: 50 },
  { key: 'notes20', label: '₹20', value: 20 },
  { key: 'notes10', label: '₹10', value: 10 },
  { key: 'coins', label: 'Coins', value: 1 },
];

const Counter = () => {
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('current');
  const [openingCash, setOpeningCash] = useState('');
  const [openingDenomination, setOpeningDenomination] = useState({
    notes2000: 0, notes500: 0, notes200: 0, notes100: 0,
    notes50: 0, notes20: 0, notes10: 0, coins: 0,
  });
  const [showDenomination, setShowDenomination] = useState(false);
  const [closeForm, setCloseForm] = useState({ declaredCash: '', declaredCard: '', declaredUPI: '', varianceNote: '' });
  const [closeDenomination, setCloseDenomination] = useState({
    notes2000: 0, notes500: 0, notes200: 0, notes100: 0,
    notes50: 0, notes20: 0, notes10: 0, coins: 0,
  });
  const [showCloseDenom, setShowCloseDenom] = useState(false);
  const [fySummary, setFySummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const res = await api.get('/counter/current');
      setSession(res.data.session);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/counter/history');
      setHistory(res.data.sessions || []);
    } catch (err) { console.error(err); }
  };

  const fetchFY = async () => {
    try {
      const res = await api.get('/counter/financial-year');
      setFySummary(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchSession();
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'fy') fetchFY();
  }, [activeTab, fetchSession]);

  useSocket('counter:open', () => fetchSession());
  useSocket('counter:close', () => fetchSession());

  // Refresh live data every 30s when session is open
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(fetchSession, 30000);
    return () => clearInterval(interval);
  }, [session, fetchSession]);

  const handleOpen = async (e) => {
    e.preventDefault();
    const cashAmount = showDenomination
      ? DENOMINATIONS.reduce((sum, d) => sum + (openingDenomination[d.key] || 0) * d.value, 0)
      : (parseFloat(openingCash) || 0);
    try {
      await api.post('/counter/open', { openingCash: cashAmount });
      toast.success('Counter opened!');
      setOpeningCash('');
      setOpeningDenomination({ notes2000: 0, notes500: 0, notes200: 0, notes100: 0, notes50: 0, notes20: 0, notes10: 0, coins: 0 });
      setShowDenomination(false);
      fetchSession();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleClose = async (e) => {
    e.preventDefault();
    if (!window.confirm('Close the current counter session?')) return;
    try {
      const payload = {
        declaredCard: parseFloat(closeForm.declaredCard) || 0,
        declaredUPI: parseFloat(closeForm.declaredUPI) || 0,
        varianceNote: closeForm.varianceNote,
      };
      if (showCloseDenom) {
        payload.denomination = closeDenomination;
      } else {
        payload.declaredCash = parseFloat(closeForm.declaredCash) || 0;
      }
      await api.post('/counter/close', payload);
      toast.success('Counter closed! Auto-backup triggered.');
      setCloseForm({ declaredCash: '', declaredCard: '', declaredUPI: '', varianceNote: '' });
      setCloseDenomination({ notes2000: 0, notes500: 0, notes200: 0, notes100: 0, notes50: 0, notes20: 0, notes10: 0, coins: 0 });
      setShowCloseDenom(false);
      fetchSession();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <div className="text-center mt-16">Loading...</div>;

  return (
    <div className="counter-page">
      <div className="page-header">
        <h1><FiClock style={{ marginRight: 8 }} />Counter & Shifts</h1>
        <div className="flex gap-8">
          <div className="report-tabs">
            {[{ id: 'current', label: 'Current Shift' }, { id: 'history', label: 'History' }, { id: 'fy', label: 'Financial Year' }].map(t => (
              <button key={t.id} className={`btn ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>
          {activeTab === 'history' && (
            <>
              <button className="btn btn-secondary" onClick={() => downloadExport('/export/counter/pdf', 'counter-history.pdf')}><FiDownload /> PDF</button>
              <button className="btn btn-success" onClick={() => downloadExport('/export/counter/excel', 'counter-history.xlsx')}><FiDownload /> Excel</button>
            </>
          )}
        </div>
      </div>

      {activeTab === 'current' && (
        <>
          {session ? (
            <>
              <div className="counter-status">
                <h2>Counter Open — Shift #{session.shiftNumber}</h2>
                <div className="counter-meta">
                  Opened by {session.openedBy?.name} at {new Date(session.openedAt).toLocaleTimeString('en-IN')} ·
                  Opening Cash: ₹{session.openingCash?.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="live-grid">
                <div className="stat-card"><div className="stat-label">Total Orders</div><div className="stat-value">{session.totalOrders || 0}</div></div>
                <div className="stat-card"><div className="stat-label">Cash Sales</div><div className="stat-value">₹{(session.systemCash || 0).toLocaleString('en-IN')}</div></div>
                <div className="stat-card"><div className="stat-label">Card Sales</div><div className="stat-value">₹{(session.systemCard || 0).toLocaleString('en-IN')}</div></div>
                <div className="stat-card"><div className="stat-label">UPI Sales</div><div className="stat-value">₹{(session.systemUPI || 0).toLocaleString('en-IN')}</div></div>
                <div className="stat-card"><div className="stat-label">Total Sales</div><div className="stat-value" style={{ color: 'var(--success)' }}>₹{(session.systemTotal || 0).toLocaleString('en-IN')}</div></div>
                <div className="stat-card"><div className="stat-label">GST Collected</div><div className="stat-value">₹{(session.gstCollected || 0).toLocaleString('en-IN')}</div></div>
                <div className="stat-card"><div className="stat-label">Expenses</div><div className="stat-value" style={{ color: 'var(--danger)' }}>₹{(session.totalExpenses || 0).toLocaleString('en-IN')}</div></div>
                <div className="stat-card"><div className="stat-label">Expected Cash</div><div className="stat-value">₹{((session.openingCash || 0) + (session.systemCash || 0) - (session.totalExpenses || 0)).toLocaleString('en-IN')}</div></div>
              </div>

              <div className="card close-form">
                <h3 className="mb-16"><FiDollarSign style={{ marginRight: 6 }} />Close Counter</h3>
                <form onSubmit={handleClose}>
                  <div className="flex-between mb-16">
                    <label style={{ fontWeight: 600 }}>Cash Count Method:</label>
                    <div className="flex gap-8">
                      <button type="button" className={`btn btn-sm ${!showCloseDenom ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowCloseDenom(false)}>Quick</button>
                      <button type="button" className={`btn btn-sm ${showCloseDenom ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowCloseDenom(true)}>By Notes</button>
                    </div>
                  </div>
                  {showCloseDenom ? (
                    <div className="denomination-counter mb-16">
                      {DENOMINATIONS.map(d => (
                        <div key={d.key} className="denomination-row-counter">
                          <span className="denomination-label-counter">{d.label}</span>
                          <span>×</span>
                          <input className="input" type="number" min="0" style={{ width: 80, textAlign: 'center' }} value={closeDenomination[d.key] || ''} onChange={e => setCloseDenomination({ ...closeDenomination, [d.key]: parseInt(e.target.value) || 0 })} placeholder="0" />
                          <span className="text-secondary" style={{ textAlign: 'right', minWidth: 80 }}>= ₹{((closeDenomination[d.key] || 0) * d.value).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                      <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 18, marginTop: 8, padding: '8px 0', borderTop: '2px solid var(--border)' }}>
                        Cash Total: ₹{DENOMINATIONS.reduce((sum, d) => sum + (closeDenomination[d.key] || 0) * d.value, 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ) : (
                    <div className="input-group"><label>Declared Cash in Drawer (₹)</label><input className="input" type="number" min="0" step="0.01" value={closeForm.declaredCash} onChange={e => setCloseForm({ ...closeForm, declaredCash: e.target.value })} required /></div>
                  )}
                  <div className="input-group"><label>Declared Card Total (₹)</label><input className="input" type="number" min="0" step="0.01" value={closeForm.declaredCard} onChange={e => setCloseForm({ ...closeForm, declaredCard: e.target.value })} /></div>
                  <div className="input-group"><label>Declared UPI Total (₹)</label><input className="input" type="number" min="0" step="0.01" value={closeForm.declaredUPI} onChange={e => setCloseForm({ ...closeForm, declaredUPI: e.target.value })} /></div>
                  <div className="input-group"><label>Notes (optional)</label><textarea className="input" rows="2" value={closeForm.varianceNote} onChange={e => setCloseForm({ ...closeForm, varianceNote: e.target.value })} placeholder="Reason for any cash variance..." /></div>
                  <button type="submit" className="btn btn-danger" style={{ width: '100%' }}><FiCheck /> Close Counter & End Shift</button>
                </form>
              </div>
            </>
          ) : (
            <div className="card counter-closed-msg">
              <h2>Counter is Closed</h2>
              <p className="text-secondary mb-24">Open a new counter session to start billing.</p>
              <form onSubmit={handleOpen} style={{ maxWidth: 400, margin: '0 auto' }}>
                <div className="flex-between mb-16">
                  <label style={{ fontWeight: 600 }}>Count Method:</label>
                  <div className="flex gap-8">
                    <button type="button" className={`btn btn-sm ${!showDenomination ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowDenomination(false)}>Quick</button>
                    <button type="button" className={`btn btn-sm ${showDenomination ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowDenomination(true)}>By Notes</button>
                  </div>
                </div>

                {showDenomination ? (
                  <div className="denomination-counter mb-16">
                    {DENOMINATIONS.map(d => (
                      <div key={d.key} className="denomination-row-counter">
                        <span className="denomination-label-counter">{d.label}</span>
                        <span>×</span>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          style={{ width: 80, textAlign: 'center' }}
                          value={openingDenomination[d.key] || ''}
                          onChange={e => setOpeningDenomination({ ...openingDenomination, [d.key]: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                        />
                        <span className="text-secondary" style={{ textAlign: 'right', minWidth: 80 }}>
                          = ₹{((openingDenomination[d.key] || 0) * d.value).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                    <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 18, marginTop: 8, padding: '8px 0', borderTop: '2px solid var(--border)' }}>
                      Total: ₹{DENOMINATIONS.reduce((sum, d) => sum + (openingDenomination[d.key] || 0) * d.value, 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                ) : (
                  <div className="input-group">
                    <label>Opening Cash (₹)</label>
                    <input className="input" type="number" min="0" step="0.01" value={openingCash} onChange={e => setOpeningCash(e.target.value)} required placeholder="Count the cash in drawer" />
                  </div>
                )}
                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}>Open Counter</button>
              </form>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div>
          {history.length === 0 ? (
            <div className="card text-center" style={{ padding: 40 }}><p className="text-secondary">No counter sessions yet</p></div>
          ) : history.map(s => (
            <div key={s._id} className="session-card">
              <div className="session-header">
                <div><strong>{s.sessionDate} — Shift #{s.shiftNumber}</strong></div>
                <span className={`badge badge-${s.status === 'verified' ? 'completed' : s.status === 'closed' ? 'ready' : 'placed'}`}>{s.status}</span>
              </div>
              <div className="grid-4" style={{ fontSize: 13 }}>
                <div><span className="text-secondary">Sales:</span> ₹{s.systemTotal?.toLocaleString('en-IN')}</div>
                <div><span className="text-secondary">Cash:</span> ₹{s.systemCash?.toLocaleString('en-IN')}</div>
                <div><span className="text-secondary">Orders:</span> {s.totalOrders}</div>
                <div><span className="text-secondary">Variance:</span> <span className={s.cashVariance >= 0 ? 'variance-pos' : 'variance-neg'}>₹{s.cashVariance?.toFixed(2)}</span></div>
              </div>
              <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-secondary)' }}>
                Opened by {s.openedBy?.name} at {new Date(s.openedAt).toLocaleTimeString('en-IN')}
                {s.closedBy && ` · Closed by ${s.closedBy.name} at ${new Date(s.closedAt).toLocaleTimeString('en-IN')}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'fy' && (
        <div>
          {fySummary ? (
            <div>
              <div className="card mb-24">
                <h3 className="mb-16">Financial Year: {fySummary.financialYear}</h3>
                <div className="grid-4">
                  <div className="stat-card"><div className="stat-label">Total Sessions</div><div className="stat-value">{fySummary.totalSessions}</div></div>
                  <div className="stat-card"><div className="stat-label">Total Sales</div><div className="stat-value" style={{ color: 'var(--success)' }}>₹{fySummary.totalSales?.toLocaleString('en-IN')}</div></div>
                  <div className="stat-card"><div className="stat-label">Total Orders</div><div className="stat-value">{fySummary.totalOrders}</div></div>
                  <div className="stat-card"><div className="stat-label">Net Profit</div><div className="stat-value" style={{ color: fySummary.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>₹{fySummary.netProfit?.toLocaleString('en-IN')}</div></div>
                </div>
              </div>
              <div className="grid-2">
                <div className="card"><h4 className="mb-8">Payment Breakdown</h4>
                  <div className="flex-between mb-8"><span className="text-secondary">Cash</span><strong>₹{fySummary.totalCash?.toLocaleString('en-IN')}</strong></div>
                  <div className="flex-between mb-8"><span className="text-secondary">Card</span><strong>₹{fySummary.totalCard?.toLocaleString('en-IN')}</strong></div>
                  <div className="flex-between mb-8"><span className="text-secondary">UPI</span><strong>₹{fySummary.totalUPI?.toLocaleString('en-IN')}</strong></div>
                </div>
                <div className="card"><h4 className="mb-8">Totals</h4>
                  <div className="flex-between mb-8"><span className="text-secondary">Expenses</span><strong style={{ color: 'var(--danger)' }}>₹{fySummary.totalExpenses?.toLocaleString('en-IN')}</strong></div>
                  <div className="flex-between mb-8"><span className="text-secondary">GST Collected</span><strong>₹{fySummary.totalGST?.toLocaleString('en-IN')}</strong></div>
                  <div className="flex-between mb-8"><span className="text-secondary">Cash Variance</span><strong className={fySummary.totalVariance >= 0 ? 'variance-pos' : 'variance-neg'}>₹{fySummary.totalVariance?.toFixed(2)}</strong></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center" style={{ padding: 40 }}><p className="text-secondary">No financial year data</p></div>
          )}
        </div>
      )}
    </div>
  );
};

export default Counter;

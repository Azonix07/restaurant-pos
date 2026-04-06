import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiCheckCircle, FiXCircle, FiClock, FiAlertTriangle, FiLock, FiFilter } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Approvals.css';

const ACTION_LABELS = {
  refund: 'Refund',
  bill_edit: 'Bill Edit',
  bill_delete: 'Bill Delete',
  wastage: 'Wastage',
  expiry_write_off: 'Expiry Write-off',
  discount_override: 'Discount Override',
  order_cancel: 'Order Cancel',
  price_change: 'Price Change',
};

const Approvals = () => {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [pinModal, setPinModal] = useState(null);
  const [pin, setPin] = useState('');
  const [historyFilter, setHistoryFilter] = useState('');

  const fetchPending = useCallback(async () => {
    try {
      const res = await api.get('/approvals/pending');
      setPending(res.data.approvals || []);
    } catch (err) {
      toast.error('Failed to load pending approvals');
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const params = {};
      if (historyFilter) params.action = historyFilter;
      const res = await api.get('/approvals/history', { params });
      setHistory(res.data.approvals || []);
    } catch (err) {
      toast.error('Failed to load history');
    }
  }, [historyFilter]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchPending(), fetchHistory()]);
      setLoading(false);
    };
    load();
  }, [fetchPending, fetchHistory]);

  const handleApprove = async () => {
    if (!pinModal || !pin) return;
    try {
      await api.post(`/approvals/${pinModal._id}/approve`, { pin });
      toast.success('Approved');
      setPinModal(null);
      setPin('');
      fetchPending();
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      await api.post(`/approvals/${id}/reject`, { reason });
      toast.success('Rejected');
      fetchPending();
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed');
    }
  };

  const getActionColor = (action) => {
    const colors = {
      refund: '#ef4444', bill_delete: '#ef4444', order_cancel: '#f59e0b',
      bill_edit: '#3b82f6', wastage: '#f97316', discount_override: '#8b5cf6',
      price_change: '#06b6d4', expiry_write_off: '#10b981',
    };
    return colors[action] || '#6b7280';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <FiCheckCircle className="status-icon approved" />;
      case 'rejected': return <FiXCircle className="status-icon rejected" />;
      case 'expired': return <FiClock className="status-icon expired" />;
      default: return <FiAlertTriangle className="status-icon pending" />;
    }
  };

  const timeAgo = (date) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) return <div className="approvals-loading">Loading...</div>;

  return (
    <div className="approvals-page">
      <div className="approvals-header">
        <div>
          <h1><FiLock /> Approvals</h1>
          {pending.length > 0 && <span className="pending-badge">{pending.length} pending</span>}
        </div>
        <div className="tab-switcher">
          <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>
            Pending {pending.length > 0 && `(${pending.length})`}
          </button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
            History
          </button>
        </div>
      </div>

      {tab === 'pending' ? (
        <div className="pending-list">
          {pending.length === 0 ? (
            <div className="empty-state">
              <FiCheckCircle size={48} />
              <p>No pending approvals</p>
            </div>
          ) : (
            pending.map(item => (
              <div key={item._id} className="approval-card pending">
                <div className="approval-badge" style={{ background: getActionColor(item.action) }}>
                  {ACTION_LABELS[item.action] || item.action}
                </div>
                <div className="approval-body">
                  <p className="approval-desc">{item.description}</p>
                  <div className="approval-meta">
                    <span>By: <strong>{item.requestedByName || item.requestedBy?.name}</strong></span>
                    <span>{timeAgo(item.createdAt)}</span>
                    {item.documentNumber && <span>#{item.documentNumber}</span>}
                  </div>
                  {item.failedPinAttempts > 0 && (
                    <div className="pin-warning">
                      <FiAlertTriangle /> {item.failedPinAttempts} failed PIN attempt(s)
                    </div>
                  )}
                </div>
                <div className="approval-actions">
                  <button className="btn-approve" onClick={() => { setPinModal(item); setPin(''); }}>
                    <FiCheckCircle /> Approve
                  </button>
                  <button className="btn-reject" onClick={() => handleReject(item._id)}>
                    <FiXCircle /> Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="history-section">
          <div className="history-filter">
            <FiFilter />
            <select value={historyFilter} onChange={e => setHistoryFilter(e.target.value)}>
              <option value="">All actions</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="history-list">
            {history.map(item => (
              <div key={item._id} className={`approval-card history ${item.status}`}>
                <div className="approval-status-col">
                  {getStatusIcon(item.status)}
                </div>
                <div className="approval-body">
                  <div className="approval-row">
                    <span className="approval-badge-sm" style={{ background: getActionColor(item.action) }}>
                      {ACTION_LABELS[item.action] || item.action}
                    </span>
                    <span className={`status-label ${item.status}`}>{item.status}</span>
                  </div>
                  <p className="approval-desc">{item.description}</p>
                  <div className="approval-meta">
                    <span>By: {item.requestedBy?.name}</span>
                    {item.approvedBy && <span>{item.status === 'approved' ? 'Approved' : 'Handled'} by: {item.approvedBy.name}</span>}
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    {item.pinVerified && <span className="pin-verified">PIN ✓</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PIN Approval Modal */}
      {pinModal && (
        <div className="modal-overlay" onClick={() => setPinModal(null)}>
          <div className="modal-content pin-modal" onClick={e => e.stopPropagation()}>
            <h2>Enter PIN to Approve</h2>
            <p className="pin-desc">{pinModal.description}</p>
            <div className="pin-input-group">
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4-digit PIN"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleApprove()}
              />
            </div>
            {pinModal.failedPinAttempts > 0 && (
              <p className="pin-warn-text">
                {3 - pinModal.failedPinAttempts} attempt(s) remaining before lockout
              </p>
            )}
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setPinModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleApprove} disabled={pin.length !== 4}>
                Verify & Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;

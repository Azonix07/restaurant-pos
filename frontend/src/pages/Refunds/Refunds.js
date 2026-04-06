import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiRotateCcw, FiCheck, FiX, FiSearch, FiFilter } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Refunds.css';

const Refunds = () => {
  const [refunds, setRefunds] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(null);
  const [pin, setPin] = useState('');
  const [requestForm, setRequestForm] = useState({ orderId: '', type: 'full', reason: '', items: [] });
  const [orderLookup, setOrderLookup] = useState(null);

  const fetchRefunds = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== 'all') params.status = filter;
      const res = await api.get('/refunds', { params });
      setRefunds(res.data.refunds || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      toast.error('Failed to load refunds');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchRefunds(); }, [fetchRefunds]);

  const lookupOrder = async () => {
    if (!requestForm.orderId) return;
    try {
      const res = await api.get(`/orders/${requestForm.orderId}`);
      setOrderLookup(res.data);
    } catch {
      toast.error('Order not found');
      setOrderLookup(null);
    }
  };

  const submitRefundRequest = async () => {
    try {
      await api.post('/refunds', {
        orderId: requestForm.orderId,
        type: requestForm.type,
        reason: requestForm.reason,
        items: requestForm.type === 'partial' ? requestForm.items : undefined,
      });
      toast.success('Refund request submitted');
      setShowRequestModal(false);
      setRequestForm({ orderId: '', type: 'full', reason: '', items: [] });
      setOrderLookup(null);
      fetchRefunds();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit refund');
    }
  };

  const handleApprove = async (refundId) => {
    try {
      await api.post(`/refunds/${refundId}/approve`, { pin });
      toast.success('Refund approved');
      setShowPinModal(null);
      setPin('');
      fetchRefunds();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed');
    }
  };

  const handleReject = async (refundId) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      await api.post(`/refunds/${refundId}/reject`, { reason });
      toast.success('Refund rejected');
      fetchRefunds();
    } catch (err) {
      toast.error('Rejection failed');
    }
  };

  const statusColor = (s) => ({
    pending: '#f59e0b', approved: '#22c55e', rejected: '#ef4444', completed: '#3b82f6',
  }[s] || '#6b7280');

  const filtered = refunds.filter(r =>
    !search || r.refundNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.reason?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="refunds-page">
      <div className="page-header">
        <h1><FiRotateCcw /> Refund Management</h1>
        <button className="btn btn-primary" onClick={() => setShowRequestModal(true)}>
          <FiRotateCcw /> Request Refund
        </button>
      </div>

      {/* Summary Cards */}
      <div className="refund-summary">
        <div className="summary-card">
          <span className="summary-label">Total Refunds</span>
          <span className="summary-value">{summary.totalCount || 0}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Amount</span>
          <span className="summary-value">₹{(summary.totalAmount || 0).toFixed(2)}</span>
        </div>
        <div className="summary-card pending">
          <span className="summary-label">Pending</span>
          <span className="summary-value">{summary.pendingCount || 0}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="refund-filters">
        <div className="search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Search refunds..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input"
          />
        </div>
        <div className="filter-tabs">
          <FiFilter />
          {['all', 'pending', 'approved', 'rejected', 'completed'].map(f => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >{f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* Refund List */}
      {loading ? (
        <div className="text-center" style={{ padding: 40 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center" style={{ padding: 40, color: '#6b7280' }}>No refunds found</div>
      ) : (
        <div className="refund-list">
          {filtered.map(refund => (
            <div key={refund._id} className="refund-card">
              <div className="refund-card-header">
                <div>
                  <strong>{refund.refundNumber}</strong>
                  <span className="refund-type badge">{refund.type}</span>
                </div>
                <span className="refund-status" style={{ color: statusColor(refund.status) }}>
                  {refund.status}
                </span>
              </div>
              <div className="refund-card-body">
                <div className="refund-detail">
                  <span>Order:</span> <strong>{refund.order?.orderNumber || refund.order}</strong>
                </div>
                <div className="refund-detail">
                  <span>Amount:</span> <strong>₹{refund.refundAmount?.toFixed(2)}</strong>
                </div>
                <div className="refund-detail">
                  <span>Reason:</span> {refund.reason}
                </div>
                <div className="refund-detail">
                  <span>Requested:</span> {new Date(refund.createdAt).toLocaleString('en-IN')}
                </div>
                {refund.requestedBy && (
                  <div className="refund-detail">
                    <span>By:</span> {refund.requestedBy?.name || 'N/A'}
                  </div>
                )}
              </div>
              {refund.status === 'pending' && (
                <div className="refund-card-actions">
                  <button className="btn btn-sm btn-success" onClick={() => setShowPinModal(refund._id)}>
                    <FiCheck /> Approve
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleReject(refund._id)}>
                    <FiX /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Request Refund</h3>
              <button className="btn btn-sm" onClick={() => setShowRequestModal(false)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Order ID</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    value={requestForm.orderId}
                    onChange={e => setRequestForm(p => ({ ...p, orderId: e.target.value }))}
                    placeholder="Enter order ID"
                  />
                  <button className="btn btn-sm btn-primary" onClick={lookupOrder}>Lookup</button>
                </div>
              </div>
              {orderLookup && (
                <div className="order-preview">
                  <p>Order #{orderLookup.orderNumber} — ₹{orderLookup.total?.toFixed(2)}</p>
                  <p>{orderLookup.items?.length} items</p>
                </div>
              )}
              <div className="form-group">
                <label>Type</label>
                <select
                  className="input"
                  value={requestForm.type}
                  onChange={e => setRequestForm(p => ({ ...p, type: e.target.value }))}
                >
                  <option value="full">Full Refund</option>
                  <option value="partial">Partial Refund</option>
                </select>
              </div>
              <div className="form-group">
                <label>Reason</label>
                <textarea
                  className="input"
                  rows={3}
                  value={requestForm.reason}
                  onChange={e => setRequestForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder="Reason for refund"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowRequestModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitRefundRequest} disabled={!requestForm.orderId || !requestForm.reason}>
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <div className="modal-overlay" onClick={() => { setShowPinModal(null); setPin(''); }}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Enter Manager PIN</h3></div>
            <div className="modal-body">
              <input
                type="password"
                className="input pin-input"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Enter PIN"
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => { setShowPinModal(null); setPin(''); }}>Cancel</button>
              <button className="btn btn-success" onClick={() => handleApprove(showPinModal)} disabled={!pin}>
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Refunds;

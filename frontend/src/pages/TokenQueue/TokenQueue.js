import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { FiHash, FiPlus, FiVolume2, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './TokenQueue.css';

const TokenQueue = () => {
  const [tokens, setTokens] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ customerName: '', estimatedMinutes: 15, counter: '' });

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/tokens');
      setTokens(res.data.tokens || []);
      setStats(res.data.stats || {});
    } catch {
      toast.error('Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);
  useSocket('token:new', fetchTokens);
  useSocket('token:updated', fetchTokens);

  const createToken = async () => {
    try {
      const res = await api.post('/tokens', form);
      toast.success(`Token #${res.data.token.tokenNumber} created`);
      setShowCreate(false);
      setForm({ customerName: '', estimatedMinutes: 15, counter: '' });
      fetchTokens();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create token');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/tokens/${id}/status`, { status });
      toast.success(`Token ${status}`);
      fetchTokens();
    } catch {
      toast.error('Update failed');
    }
  };

  const callToken = async (id) => {
    try {
      await api.post(`/tokens/${id}/call`);
      toast.success('Token called');
    } catch {
      toast.error('Call failed');
    }
  };

  const statusIcon = {
    waiting: '⏳', preparing: '🔥', ready: '✅', collected: '📦', cancelled: '❌',
  };

  const grouped = {
    waiting: tokens.filter(t => t.status === 'waiting'),
    preparing: tokens.filter(t => t.status === 'preparing'),
    ready: tokens.filter(t => t.status === 'ready'),
    done: tokens.filter(t => t.status === 'collected' || t.status === 'cancelled'),
  };

  return (
    <div className="token-page">
      <div className="page-header">
        <h1><FiHash /> Token Queue</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-sm" onClick={fetchTokens}><FiRefreshCw /></button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <FiPlus /> New Token
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="token-stats">
        <div className="stat-card waiting">
          <span className="stat-num">{stats.waiting || 0}</span>
          <span className="stat-label">Waiting</span>
        </div>
        <div className="stat-card preparing">
          <span className="stat-num">{stats.preparing || 0}</span>
          <span className="stat-label">Preparing</span>
        </div>
        <div className="stat-card ready">
          <span className="stat-num">{stats.ready || 0}</span>
          <span className="stat-label">Ready</span>
        </div>
        <div className="stat-card total">
          <span className="stat-num">{stats.total || 0}</span>
          <span className="stat-label">Total Today</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center" style={{ padding: 40 }}>Loading...</div>
      ) : (
        <div className="token-board">
          {/* Waiting */}
          <div className="token-column">
            <h3 className="column-title waiting">⏳ Waiting ({grouped.waiting.length})</h3>
            {grouped.waiting.map(t => (
              <div key={t._id} className="token-card">
                <div className="token-number">#{t.tokenNumber}</div>
                <div className="token-name">{t.customerName || 'Walk-in'}</div>
                <div className="token-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => updateStatus(t._id, 'preparing')}>
                    Start Prep
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => updateStatus(t._id, 'cancelled')}>
                    <FiX />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Preparing */}
          <div className="token-column">
            <h3 className="column-title preparing">🔥 Preparing ({grouped.preparing.length})</h3>
            {grouped.preparing.map(t => (
              <div key={t._id} className="token-card">
                <div className="token-number">#{t.tokenNumber}</div>
                <div className="token-name">{t.customerName || 'Walk-in'}</div>
                <div className="token-actions">
                  <button className="btn btn-sm btn-success" onClick={() => updateStatus(t._id, 'ready')}>
                    <FiCheck /> Ready
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Ready */}
          <div className="token-column">
            <h3 className="column-title ready">✅ Ready ({grouped.ready.length})</h3>
            {grouped.ready.map(t => (
              <div key={t._id} className="token-card ready-card">
                <div className="token-number">#{t.tokenNumber}</div>
                <div className="token-name">{t.customerName || 'Walk-in'}</div>
                <div className="token-actions">
                  <button className="btn btn-sm" onClick={() => callToken(t._id)}>
                    <FiVolume2 /> Call
                  </button>
                  <button className="btn btn-sm btn-success" onClick={() => updateStatus(t._id, 'collected')}>
                    Collected
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Token</h3>
              <button className="btn btn-sm" onClick={() => setShowCreate(false)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Customer Name (optional)</label>
                <input
                  className="input"
                  value={form.customerName}
                  onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))}
                  placeholder="Walk-in customer"
                />
              </div>
              <div className="form-group">
                <label>Estimated Wait (minutes)</label>
                <input
                  className="input"
                  type="number"
                  value={form.estimatedMinutes}
                  onChange={e => setForm(p => ({ ...p, estimatedMinutes: parseInt(e.target.value) || 15 }))}
                />
              </div>
              <div className="form-group">
                <label>Counter (optional)</label>
                <input
                  className="input"
                  value={form.counter}
                  onChange={e => setForm(p => ({ ...p, counter: e.target.value }))}
                  placeholder="Counter 1"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createToken}>Create Token</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenQueue;

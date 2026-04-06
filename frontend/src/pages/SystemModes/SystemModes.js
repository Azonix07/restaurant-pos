import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { FiZap, FiDroplet, FiLayout, FiShield, FiToggleLeft, FiToggleRight, FiTrash2, FiDatabase, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './SystemModes.css';

const SystemModes = () => {
  const { hasRole } = useAuth();
  const { settings, isRushMode, isTestMode, uiMode, fetchSettings } = useSettings();
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [testDataCount, setTestDataCount] = useState(20);
  const [loading, setLoading] = useState(false);

  const toggleRush = async () => {
    try {
      setLoading(true);
      const res = await api.post('/settings/rush-mode/toggle');
      toast.success(res.data.message);
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  const toggleTest = async () => {
    try {
      setLoading(true);
      const res = await api.post('/settings/test-mode/toggle', { pin });
      toast.success(res.data.message);
      setShowPin(false);
      setPin('');
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  const generateTestData = async () => {
    try {
      setLoading(true);
      const res = await api.post('/settings/test-mode/generate', { count: testDataCount });
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  const clearTestData = async () => {
    if (!window.confirm('Delete all test orders?')) return;
    try {
      const res = await api.post('/settings/test-mode/clear');
      toast.success(res.data.message);
    } catch (err) {
      toast.error('Failed to clear');
    }
  };

  const setUIMode = async (mode) => {
    try {
      const res = await api.put('/settings/ui-mode', { mode });
      toast.success(res.data.message);
      fetchSettings();
    } catch (err) {
      toast.error('Failed');
    }
  };

  const rushConfig = settings?.rushMode || {};
  const testAutoDisable = settings?.testMode?.autoDisableAt;

  return (
    <div className="system-modes-page">
      <div className="page-header">
        <h1><FiShield /> System Modes</h1>
      </div>

      <div className="modes-grid">
        {/* Rush Mode Card */}
        <div className={`mode-card ${isRushMode ? 'active rush' : ''}`}>
          <div className="mode-card-header">
            <div className="mode-icon rush"><FiZap size={28} /></div>
            <div>
              <h2>Rush Mode</h2>
              <p>High-speed operations for peak hours</p>
            </div>
            <button
              className={`toggle-btn ${isRushMode ? 'on' : ''}`}
              onClick={toggleRush}
              disabled={loading || !hasRole('admin', 'manager')}
            >
              {isRushMode ? <FiToggleRight size={32} /> : <FiToggleLeft size={32} />}
            </button>
          </div>

          <div className="mode-features">
            <h4>When enabled:</h4>
            <ul>
              <li className={rushConfig.disableImages ? 'active' : ''}>Text-only menu (no images)</li>
              <li className={rushConfig.disableAnimations ? 'active' : ''}>No animations</li>
              <li className={rushConfig.autoKOT ? 'active' : ''}>Auto-send KOT (skip confirmation)</li>
              <li className={rushConfig.autoAssignTables ? 'active' : ''}>Auto-assign tables</li>
              <li className={rushConfig.disableEditOldBills ? 'active' : ''}>Cannot edit old bills</li>
              <li className={rushConfig.disableComplexDiscounts ? 'active' : ''}>Simple discounts only</li>
              <li className={rushConfig.disableReports ? 'active' : ''}>Reports disabled</li>
            </ul>
          </div>

          {isRushMode && rushConfig.enabledAt && (
            <div className="mode-status">
              Active since {new Date(rushConfig.enabledAt).toLocaleTimeString('en-IN')}
            </div>
          )}
        </div>

        {/* Test Mode Card */}
        {hasRole('admin') && (
          <div className={`mode-card ${isTestMode ? 'active test' : ''}`}>
            <div className="mode-card-header">
              <div className="mode-icon test"><FiDroplet size={28} /></div>
              <div>
                <h2>Test Mode</h2>
                <p>Safe simulation environment</p>
              </div>
              <button
                className={`toggle-btn ${isTestMode ? 'on' : ''}`}
                onClick={() => isTestMode ? toggleTest() : setShowPin(true)}
                disabled={loading}
              >
                {isTestMode ? <FiToggleRight size={32} /> : <FiToggleLeft size={32} />}
              </button>
            </div>

            <div className="mode-features">
              <h4>When enabled:</h4>
              <ul>
                <li>No real billing or GST records</li>
                <li>No real inventory updates</li>
                <li>Generate fake orders for testing</li>
                <li>Auto-disables after 1 hour</li>
              </ul>
            </div>

            {isTestMode && (
              <div className="test-controls">
                {testAutoDisable && (
                  <div className="mode-status">
                    Auto-disables at {new Date(testAutoDisable).toLocaleTimeString('en-IN')}
                  </div>
                )}
                <div className="test-data-controls">
                  <input
                    type="number"
                    className="input"
                    value={testDataCount}
                    onChange={e => setTestDataCount(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: 80 }}
                    min="1"
                    max="100"
                  />
                  <button className="btn btn-primary btn-sm" onClick={generateTestData} disabled={loading}>
                    <FiDatabase /> Generate {testDataCount} Orders
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={clearTestData}>
                    <FiTrash2 /> Clear Test Data
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* UI Mode Card */}
        <div className="mode-card">
          <div className="mode-card-header">
            <div className="mode-icon ui"><FiLayout size={28} /></div>
            <div>
              <h2>Interface Mode</h2>
              <p>Choose complexity level for all users</p>
            </div>
          </div>

          <div className="ui-mode-options">
            <button
              className={`ui-mode-btn ${uiMode === 'beginner' ? 'active' : ''}`}
              onClick={() => setUIMode('beginner')}
              disabled={!hasRole('admin', 'manager')}
            >
              <span className="ui-mode-emoji">🟢</span>
              <div>
                <strong>Beginner</strong>
                <p>Simplified screens. New staff friendly. Essential features only.</p>
              </div>
            </button>
            <button
              className={`ui-mode-btn ${uiMode === 'advanced' ? 'active' : ''}`}
              onClick={() => setUIMode('advanced')}
              disabled={!hasRole('admin', 'manager')}
            >
              <span className="ui-mode-emoji">🔵</span>
              <div>
                <strong>Advanced</strong>
                <p>Full features. All settings and analytics accessible.</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* PIN Modal for Test Mode */}
      {showPin && (
        <div className="modal-overlay" onClick={() => { setShowPin(false); setPin(''); }}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Admin PIN Required</h3>
              <button className="btn btn-sm" onClick={() => { setShowPin(false); setPin(''); }}><FiX /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Test Mode creates fake data. No real billing will occur.
              </p>
              <input
                type="password"
                className="input"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Enter your PIN"
                autoFocus
                style={{ textAlign: 'center', fontSize: 20, letterSpacing: 8 }}
              />
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => { setShowPin(false); setPin(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={toggleTest} disabled={!pin || loading}>
                Enable Test Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemModes;

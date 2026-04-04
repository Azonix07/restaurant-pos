import React, { useState, useEffect, useRef } from 'react';
import { FiWifi, FiWifiOff, FiCloud, FiCloudOff, FiRefreshCw } from 'react-icons/fi';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import { getOfflineQueue } from '../../utils/offlineStorage';
import { flushQueue } from '../../utils/syncQueue';
import connectionManager from '../../utils/connectionManager';
import './ConnectionStatus.css';

const ConnectionStatus = () => {
  const { mode, lanReachable, internetReachable } = useConnectionStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const detailsRef = useRef(null);

  // Check offline queue count periodically
  useEffect(() => {
    const check = async () => {
      try {
        const queue = await getOfflineQueue();
        setQueueCount(queue.length);
      } catch { /* ignore */ }
    };
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, []);

  // Close details popup on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (detailsRef.current && !detailsRef.current.contains(e.target)) {
        setShowDetails(false);
      }
    };
    if (showDetails) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDetails]);

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      await connectionManager.recheckNow();
      await flushQueue();
    } catch { /* ignore */ }
    setSyncing(false);
  };

  const modeConfig = {
    online: { icon: <FiCloud />, label: 'Online', color: '#10b981', bg: '#ecfdf5' },
    lan: { icon: <FiWifi />, label: 'LAN Only', color: '#f59e0b', bg: '#fffbeb' },
    offline: { icon: <FiWifiOff />, label: 'Offline', color: '#ef4444', bg: '#fef2f2' },
  };

  const cfg = modeConfig[mode] || modeConfig.offline;

  return (
    <div className="connection-status-wrapper" ref={detailsRef}>
      <button
        className="connection-status-pill"
        style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.color + '33' }}
        onClick={() => setShowDetails(!showDetails)}
        title={`Mode: ${cfg.label}`}
      >
        {cfg.icon}
        <span className="connection-label">{cfg.label}</span>
        {queueCount > 0 && (
          <span className="queue-badge">{queueCount}</span>
        )}
      </button>

      {showDetails && (
        <div className="connection-details-popup">
          <div className="connection-detail-row">
            <span>LAN Server</span>
            <span className={`detail-status ${lanReachable ? 'ok' : 'fail'}`}>
              {lanReachable ? 'Connected' : 'Unreachable'}
            </span>
          </div>
          <div className="connection-detail-row">
            <span>Internet</span>
            <span className={`detail-status ${internetReachable ? 'ok' : 'fail'}`}>
              {internetReachable ? 'Connected' : 'No Internet'}
            </span>
          </div>
          {queueCount > 0 && (
            <div className="connection-detail-row">
              <span>Pending Operations</span>
              <span className="detail-status pending">{queueCount} queued</span>
            </div>
          )}
          <button
            className="sync-now-btn"
            onClick={handleForceSync}
            disabled={syncing}
          >
            <FiRefreshCw className={syncing ? 'spinning' : ''} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;

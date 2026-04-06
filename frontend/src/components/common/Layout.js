import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ConnectionStatus from './ConnectionStatus';
import connectionManager from '../../utils/connectionManager';
import { startAutoSync } from '../../utils/syncQueue';
import { useSettings } from '../../context/SettingsContext';
import './Layout.css';

const Layout = () => {
  const { isRushMode, isTestMode } = useSettings();

  useEffect(() => {
    connectionManager.startMonitoring();
    startAutoSync();
    return () => {
      connectionManager.stopMonitoring();
    };
  }, []);

  return (
    <div className={`layout ${isRushMode ? 'rush-mode' : ''} ${isTestMode ? 'test-mode' : ''}`}>
      <Sidebar />
      <main className="main-content">
        <div className="topbar">
          <div className="topbar-indicators">
            {isRushMode && <span className="mode-badge rush">⚡ RUSH MODE</span>}
            {isTestMode && <span className="mode-badge test">🧪 TEST MODE</span>}
          </div>
          <div className="topbar-spacer" />
          <ConnectionStatus />
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

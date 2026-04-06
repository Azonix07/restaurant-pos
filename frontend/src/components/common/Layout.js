import React, { useEffect, useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import ConnectionStatus from './ConnectionStatus';
import AIChatWidget from './AIChatWidget';
import connectionManager from '../../utils/connectionManager';
import { startAutoSync } from '../../utils/syncQueue';
import { useSettings } from '../../context/SettingsContext';
import { FiMenu } from 'react-icons/fi';
import './Layout.css';

const Layout = () => {
  const { isRushMode, isTestMode } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    connectionManager.startMonitoring();
    startAutoSync();
    return () => {
      connectionManager.stopMonitoring();
    };
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className={`layout ${isRushMode ? 'rush-mode' : ''} ${isTestMode ? 'test-mode' : ''}`}>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar} />}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <main className="main-content">
        <div className="topbar">
          <button className="mobile-menu-btn" onClick={toggleSidebar} aria-label="Toggle menu">
            <FiMenu />
          </button>
          <div className="topbar-indicators">
            {isRushMode && <span className="mode-badge rush">⚡ RUSH MODE</span>}
            {isTestMode && <span className="mode-badge test">🧪 TEST MODE</span>}
          </div>
          <div className="topbar-spacer" />
          <ConnectionStatus />
        </div>
        <Outlet />
      </main>
      <AIChatWidget />
    </div>
  );
};

export default Layout;

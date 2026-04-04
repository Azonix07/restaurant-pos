import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ConnectionStatus from './ConnectionStatus';
import connectionManager from '../../utils/connectionManager';
import { startAutoSync } from '../../utils/syncQueue';
import './Layout.css';

const Layout = () => {
  useEffect(() => {
    // Start connection monitoring and auto-sync on mount
    connectionManager.startMonitoring();
    startAutoSync();
    return () => {
      connectionManager.stopMonitoring();
    };
  }, []);

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="topbar">
          <div className="topbar-spacer" />
          <ConnectionStatus />
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

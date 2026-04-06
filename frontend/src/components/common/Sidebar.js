import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiShoppingCart, FiGrid, FiMonitor, FiDollarSign,
  FiTruck, FiBarChart2, FiBook, FiSettings, FiLogOut, FiSmartphone,
  FiUsers, FiFileText, FiPackage, FiPercent, FiTrash2, FiEye,
  FiTool, FiBriefcase, FiRefreshCw, FiActivity, FiClipboard,
  FiUserCheck, FiBox, FiAlertTriangle, FiCpu, FiChevronDown, FiChevronRight,
  FiClock, FiLayers, FiShield, FiDatabase, FiHash, FiTrendingUp, FiCreditCard,
  FiPause, FiRotateCcw, FiZap, FiMessageSquare, FiCheckSquare
} from 'react-icons/fi';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [expandedGroups, setExpandedGroups] = useState({ operations: true });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Grouped navigation - much cleaner mental model
  const menuGroups = [
    {
      key: 'main',
      items: [
        { path: '/', icon: <FiHome />, label: 'Dashboard', roles: ['admin', 'manager', 'cashier', 'waiter'] },
        { path: '/ai-assistant', icon: <FiMessageSquare />, label: 'AI Assistant', roles: ['admin', 'manager'] },
      ],
    },
    {
      key: 'operations',
      label: 'Operations',
      roles: ['admin', 'manager', 'cashier', 'waiter'],
      items: [
        { path: '/orders', icon: <FiShoppingCart />, label: 'Orders', roles: ['admin', 'manager', 'cashier', 'waiter'] },
        { path: '/tables', icon: <FiGrid />, label: 'Tables', roles: ['admin', 'manager', 'cashier', 'waiter'] },
        { path: '/billing', icon: <FiDollarSign />, label: 'Billing', roles: ['admin', 'manager', 'cashier'] },
        { path: '/counter', icon: <FiClock />, label: 'Counter & Shifts', roles: ['admin', 'manager', 'cashier'] },
        { path: '/customers', icon: <FiUserCheck />, label: 'Customers', roles: ['admin', 'manager', 'cashier'] },
        { path: '/held-orders', icon: <FiPause />, label: 'Held Orders', roles: ['admin', 'manager', 'cashier'] },
        { path: '/refunds', icon: <FiRotateCcw />, label: 'Refunds', roles: ['admin', 'manager', 'cashier'] },
        { path: '/token-queue', icon: <FiHash />, label: 'Token Queue', roles: ['admin', 'manager', 'cashier'] },
      ],
    },
    {
      key: 'kitchen',
      label: 'Kitchen',
      roles: ['admin', 'manager', 'cashier', 'waiter'],
      items: [
        { path: '/kitchen', icon: <FiMonitor />, label: 'Kitchen Display', roles: ['admin', 'manager', 'cashier', 'waiter'] },
        { path: '/kitchen-kot', icon: <FiClipboard />, label: 'KOT Display', roles: ['admin', 'manager', 'cashier', 'waiter'] },
      ],
    },
    {
      key: 'inventory',
      label: 'Inventory',
      roles: ['admin', 'manager'],
      items: [
        { path: '/inventory', icon: <FiPackage />, label: 'Menu Items', roles: ['admin', 'manager'] },
        { path: '/stock-management', icon: <FiBox />, label: 'Stock & BOM', roles: ['admin', 'manager'] },
        { path: '/production', icon: <FiLayers />, label: 'Production', roles: ['admin', 'manager'] },
        { path: '/wastage', icon: <FiAlertTriangle />, label: 'Wastage', roles: ['admin', 'manager'] },
        { path: '/barcode-manager', icon: <FiHash />, label: 'Barcode Manager', roles: ['admin', 'manager'] },
        { path: '/suppliers', icon: <FiTruck />, label: 'Suppliers & Purchase', roles: ['admin', 'manager'] },
      ],
    },
    {
      key: 'finance',
      label: 'Finance',
      roles: ['admin', 'manager'],
      items: [
        { path: '/invoices', icon: <FiFileText />, label: 'Invoices', roles: ['admin', 'manager', 'cashier'] },
        { path: '/parties', icon: <FiUsers />, label: 'Parties', roles: ['admin', 'manager'] },
        { path: '/accounting', icon: <FiBook />, label: 'Accounting', roles: ['admin', 'manager'] },
        { path: '/reports', icon: <FiBarChart2 />, label: 'Reports', roles: ['admin', 'manager'] },
        { path: '/sales-history', icon: <FiTrendingUp />, label: 'Sales History', roles: ['admin', 'manager'] },
        { path: '/company-credit', icon: <FiCreditCard />, label: 'Company Credit', roles: ['admin', 'manager'] },
        { path: '/gst-reports', icon: <FiPercent />, label: 'GST Reports', roles: ['admin', 'manager'] },
        { path: '/fixed-assets', icon: <FiTool />, label: 'Fixed Assets', roles: ['admin', 'manager'] },
      ],
    },
    {
      key: 'channels',
      label: 'Channels',
      roles: ['admin', 'manager'],
      items: [
        { path: '/external-orders', icon: <FiTruck />, label: 'External Orders', roles: ['admin', 'manager'] },
        { path: '/qr-codes', icon: <FiSmartphone />, label: 'QR Ordering', roles: ['admin', 'manager'] },
      ],
    },
    {
      key: 'system',
      label: 'System',
      roles: ['admin'],
      items: [
        { path: '/monitoring', icon: <FiActivity />, label: 'Monitoring', roles: ['admin', 'manager'] },
        { path: '/system-modes', icon: <FiZap />, label: 'System Modes', roles: ['admin', 'manager'] },
        { path: '/fraud-dashboard', icon: <FiShield />, label: 'Anti-Fraud', roles: ['admin', 'manager'] },
        { path: '/staff-analysis', icon: <FiUserCheck />, label: 'Staff Analysis', roles: ['admin', 'manager'] },
        { path: '/backup', icon: <FiDatabase />, label: 'Backup', roles: ['admin'] },
        { path: '/devices', icon: <FiCpu />, label: 'Devices', roles: ['admin'] },
        { path: '/companies', icon: <FiBriefcase />, label: 'Companies', roles: ['admin'] },
        { path: '/tally', icon: <FiRefreshCw />, label: 'Tally Sync', roles: ['admin'] },
        { path: '/audit-trail', icon: <FiEye />, label: 'Audit Trail', roles: ['admin'] },
        { path: '/recycle-bin', icon: <FiTrash2 />, label: 'Recycle Bin', roles: ['admin'] },
        { path: '/role-management', icon: <FiShield />, label: 'Roles', roles: ['admin'] },
        { path: '/approvals', icon: <FiCheckSquare />, label: 'Approvals', roles: ['admin', 'manager'] },
        { path: '/settings', icon: <FiSettings />, label: 'Settings', roles: ['admin'] },
      ],
    },
  ];

  const renderLink = (item) => (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
      end={item.path === '/'}
    >
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  );

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="brand-icon">🍽️</span>
          <div>
            <h2>POS System</h2>
            <span className="sidebar-version">v2.0</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuGroups.map(group => {
          const visibleItems = group.items.filter(item => item.roles.some(r => hasRole(r)));
          if (visibleItems.length === 0) return null;

          // Ungrouped items (like Dashboard)
          if (!group.label) {
            return visibleItems.map(item => renderLink(item));
          }

          // Check if any item in group is accessible
          if (group.roles && !group.roles.some(r => hasRole(r))) return null;

          const isExpanded = expandedGroups[group.key];

          return (
            <div key={group.key} className="sidebar-group">
              <button
                className={`sidebar-group-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleGroup(group.key)}
              >
                <span className="group-label">{group.label}</span>
                {isExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
              </button>
              {isExpanded && (
                <div className="sidebar-group-items">
                  {visibleItems.map(item => renderLink(item))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-card">
          <div className="sidebar-user-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="sidebar-user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-role-badge">{user?.role}</span>
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout} title="Logout">
            <FiLogOut />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

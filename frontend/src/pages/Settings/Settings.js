import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FiPlus, FiX, FiDownload, FiUpload, FiMail, FiSave, FiWifi, FiCloud, FiRefreshCw, FiEdit2, FiShield } from 'react-icons/fi';
import { toast } from 'react-toastify';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import { getOfflineQueue, clearOfflineQueue } from '../../utils/offlineStorage';
import { fullSync } from '../../utils/syncQueue';
import connectionManager from '../../utils/connectionManager';
import './Settings.css';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'waiter', phone: '' });
  const [menuForm, setMenuForm] = useState({ name: '', category: '', price: '', isVeg: true, gstCategory: 'food_non_ac', preparationTime: 15, description: '' });
  const [menuSearch, setMenuSearch] = useState('');
  const [showPermissions, setShowPermissions] = useState(null);
  const { hasRole } = useAuth();

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'menu') fetchMenu();
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data.users || []);
    } catch (err) { console.error(err); }
  };

  const fetchMenu = async () => {
    try {
      const res = await api.get('/menu');
      setMenuItems(res.data.items || []);
    } catch (err) { console.error(err); }
  };

  const addUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', userForm);
      toast.success('User created');
      setShowAddUser(false);
      setUserForm({ name: '', email: '', password: '', role: 'waiter', phone: '' });
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const toggleUserActive = async (user) => {
    try {
      await api.put(`/auth/users/${user._id}`, { isActive: !user.isActive });
      fetchUsers();
    } catch (err) { toast.error('Failed'); }
  };

  const openPermissions = (user) => {
    setShowPermissions({
      _id: user._id,
      name: user.name,
      role: user.role,
      permissions: user.permissions || {
        canEditPrice: false, canGiveDiscount: false, maxDiscountPercent: 0,
        canCancelOrder: false, canDeleteKOT: false, canViewReports: false,
        canExportData: false, canModifyMenu: false, canManageInventory: false,
        canProcessRefund: false, canOpenCounter: false, canCloseCounter: false,
      },
      limits: user.limits || { maxOrderValue: 0, maxDailyDiscount: 0, maxSingleDiscount: 0 },
    });
  };

  const savePermissions = async () => {
    try {
      await api.put(`/auth/users/${showPermissions._id}`, {
        permissions: showPermissions.permissions,
        limits: showPermissions.limits,
      });
      toast.success('Permissions saved');
      setShowPermissions(null);
      fetchUsers();
    } catch (err) { toast.error('Failed to save permissions'); }
  };

  const togglePerm = (key) => {
    setShowPermissions(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] },
    }));
  };

  const updateLimit = (key, value) => {
    setShowPermissions(prev => ({
      ...prev,
      limits: { ...prev.limits, [key]: parseFloat(value) || 0 },
    }));
  };

  const addMenuItem = async (e) => {
    e.preventDefault();
    try {
      await api.post('/menu', { ...menuForm, price: parseFloat(menuForm.price), preparationTime: parseInt(menuForm.preparationTime, 10) });
      toast.success('Menu item added');
      setShowAddMenu(false);
      setMenuForm({ name: '', category: '', price: '', isVeg: true, gstCategory: 'food_non_ac', preparationTime: 15, description: '' });
      fetchMenu();
    } catch (err) { toast.error('Failed'); }
  };

  const toggleAvailability = async (id) => {
    try {
      await api.patch(`/menu/${id}/toggle`);
      fetchMenu();
    } catch (err) { toast.error('Failed'); }
  };

  const deleteMenuItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await api.delete(`/menu/${id}`);
      toast.success('Deleted');
      fetchMenu();
    } catch (err) { toast.error('Failed'); }
  };

  const openEditMenu = (item) => {
    setEditItem({
      _id: item._id,
      name: item.name,
      category: item.category,
      price: item.price,
      isVeg: item.isVeg,
      gstCategory: item.gstCategory || 'food_non_ac',
      preparationTime: item.preparationTime || 15,
      description: item.description || '',
    });
    setShowEditMenu(true);
  };

  const updateMenuItem = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/menu/${editItem._id}`, {
        ...editItem,
        price: parseFloat(editItem.price),
        preparationTime: parseInt(editItem.preparationTime, 10),
      });
      toast.success('Menu item updated');
      setShowEditMenu(false);
      setEditItem(null);
      fetchMenu();
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
  };

  const exportData = async () => {
    try {
      const res = await api.get('/system/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch (err) { toast.error('Export failed'); }
  };

  const importData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.collections) throw new Error('Invalid format');
      if (!window.confirm('This will merge imported data with existing data. Continue?')) return;
      const res = await api.post('/system/import', data);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.message === 'Invalid format' ? 'Invalid file format' : 'Import failed');
    }
    e.target.value = '';
  };

  const createBackup = async () => {
    try {
      const res = await api.post('/system/backup');
      toast.success(res.data.message);
    } catch (err) { toast.error('Backup failed'); }
  };

  const sendReport = async () => {
    try {
      const res = await api.post('/system/send-report');
      toast.success(res.data.message);
    } catch (err) { toast.error('Failed to send report'); }
  };

  return (
    <div>
      <div className="page-header"><h1>Settings</h1></div>

      <div className="report-tabs mb-24">
        {['users', 'menu', 'network', 'system'].map(tab => (
          <button key={tab} className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="card">
          <div className="flex-between mb-16">
            <h3>User Management</h3>
            {hasRole('admin') && <button className="btn btn-primary" onClick={() => setShowAddUser(true)}><FiPlus /> Add User</button>}
          </div>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(user => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td style={{ textTransform: 'capitalize' }}>{user.role}</td>
                  <td><span className={`badge ${user.isActive ? 'badge-completed' : 'badge-cancelled'}`}>{user.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="flex gap-4">
                      <button className={`btn btn-sm ${user.isActive ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleUserActive(user)}>{user.isActive ? 'Deactivate' : 'Activate'}</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => openPermissions(user)}><FiShield /> Permissions</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {showAddUser && (
            <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="flex-between mb-16"><h2>Add User</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowAddUser(false)}><FiX /></button></div>
                <form onSubmit={addUser}>
                  <div className="input-group"><label>Name</label><input className="input" required value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} /></div>
                  <div className="input-group"><label>Email</label><input className="input" type="email" required value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} /></div>
                  <div className="input-group"><label>Password</label><input className="input" type="password" required minLength="6" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} autoComplete="new-password" /></div>
                  <div className="input-group"><label>Role</label>
                    <select className="input" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                      <option value="admin">Admin</option><option value="manager">Manager</option><option value="cashier">Cashier</option><option value="waiter">Waiter</option>
                    </select>
                  </div>
                  <div className="input-group"><label>Phone</label><input className="input" value={userForm.phone} onChange={e => setUserForm({ ...userForm, phone: e.target.value })} /></div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create User</button>
                </form>
              </div>
            </div>
          )}

          {showPermissions && (
            <div className="modal-overlay" onClick={() => setShowPermissions(null)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
                <div className="flex-between mb-16"><h2><FiShield style={{ marginRight: 6 }} />Permissions: {showPermissions.name}</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowPermissions(null)}><FiX /></button></div>
                <p className="text-secondary mb-16">Role: <strong style={{ textTransform: 'capitalize' }}>{showPermissions.role}</strong> {showPermissions.role === 'admin' && '(has all permissions by default)'}</p>
                <h4 className="mb-8">Permissions</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {[
                    ['canEditPrice', 'Edit Menu Prices'], ['canGiveDiscount', 'Give Discounts'],
                    ['canCancelOrder', 'Cancel Orders'], ['canDeleteKOT', 'Delete KOTs'],
                    ['canViewReports', 'View Reports'], ['canExportData', 'Export Data'],
                    ['canModifyMenu', 'Modify Menu'], ['canManageInventory', 'Manage Inventory'],
                    ['canProcessRefund', 'Process Refunds'], ['canOpenCounter', 'Open Counter'],
                    ['canCloseCounter', 'Close Counter'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: 6, borderRadius: 6, background: showPermissions.permissions[key] ? '#ecfdf5' : 'var(--bg-input)' }}>
                      <input type="checkbox" checked={showPermissions.permissions[key] || false} onChange={() => togglePerm(key)} />
                      <span style={{ fontSize: 13 }}>{label}</span>
                    </label>
                  ))}
                </div>
                {showPermissions.permissions.canGiveDiscount && (
                  <div className="input-group"><label>Max Discount % per Order</label><input className="input" type="number" min="0" max="100" value={showPermissions.permissions.maxDiscountPercent || 0} onChange={e => setShowPermissions(prev => ({ ...prev, permissions: { ...prev.permissions, maxDiscountPercent: parseFloat(e.target.value) || 0 } }))} /></div>
                )}
                <h4 className="mb-8 mt-16">Daily Limits</h4>
                <div className="input-group"><label>Max Single Order Value (₹) · 0 = unlimited</label><input className="input" type="number" min="0" value={showPermissions.limits.maxOrderValue || 0} onChange={e => updateLimit('maxOrderValue', e.target.value)} /></div>
                <div className="input-group"><label>Max Total Discount per Day (₹)</label><input className="input" type="number" min="0" value={showPermissions.limits.maxDailyDiscount || 0} onChange={e => updateLimit('maxDailyDiscount', e.target.value)} /></div>
                <div className="input-group"><label>Max Discount per Order (₹)</label><input className="input" type="number" min="0" value={showPermissions.limits.maxSingleDiscount || 0} onChange={e => updateLimit('maxSingleDiscount', e.target.value)} /></div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={savePermissions}><FiSave /> Save Permissions & Limits</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'menu' && (
        <div className="card">
          <div className="flex-between mb-16">
            <h3>Menu Management</h3>
            <div className="flex gap-8">
              <input className="input" placeholder="Search menu..." value={menuSearch} onChange={e => setMenuSearch(e.target.value)} style={{ width: 200 }} />
              <button className="btn btn-primary" onClick={() => setShowAddMenu(true)}><FiPlus /> Add Item</button>
            </div>
          </div>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Type</th><th>Available</th><th>Actions</th></tr></thead>
            <tbody>
              {menuItems.filter(item => !menuSearch || item.name.toLowerCase().includes(menuSearch.toLowerCase()) || item.category.toLowerCase().includes(menuSearch.toLowerCase())).map(item => (
                <tr key={item._id}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>₹{item.price}</td>
                  <td>{item.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}</td>
                  <td><button className={`btn btn-sm ${item.isAvailable ? 'btn-success' : 'btn-danger'}`} onClick={() => toggleAvailability(item._id)}>{item.isAvailable ? 'Yes' : 'No'}</button></td>
                  <td>
                    <div className="flex gap-4">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEditMenu(item)}><FiEdit2 /> Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteMenuItem(item._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {showAddMenu && (
            <div className="modal-overlay" onClick={() => setShowAddMenu(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="flex-between mb-16"><h2>Add Menu Item</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowAddMenu(false)}><FiX /></button></div>
                <form onSubmit={addMenuItem}>
                  <div className="input-group"><label>Name</label><input className="input" required value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} /></div>
                  <div className="input-group"><label>Category</label><input className="input" required value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })} placeholder="e.g., Starters, Main Course" /></div>
                  <div className="input-group"><label>Price (₹)</label><input className="input" type="number" min="0" required value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} /></div>
                  <div className="input-group"><label>Type</label>
                    <select className="input" value={menuForm.isVeg} onChange={e => setMenuForm({ ...menuForm, isVeg: e.target.value === 'true' })}>
                      <option value="true">Veg</option><option value="false">Non-Veg</option>
                    </select>
                  </div>
                  <div className="input-group"><label>GST Category</label>
                    <select className="input" value={menuForm.gstCategory} onChange={e => setMenuForm({ ...menuForm, gstCategory: e.target.value })}>
                      <option value="food_non_ac">Food (Non-AC) - 5%</option>
                      <option value="food_ac">Food (AC) - 5%</option>
                      <option value="beverage">Beverage - 18%</option>
                      <option value="alcohol">Alcohol - 28%</option>
                    </select>
                  </div>
                  <div className="input-group"><label>Prep Time (min)</label><input className="input" type="number" value={menuForm.preparationTime} onChange={e => setMenuForm({ ...menuForm, preparationTime: e.target.value })} /></div>
                  <div className="input-group"><label>Description</label><textarea className="input" rows="2" value={menuForm.description} onChange={e => setMenuForm({ ...menuForm, description: e.target.value })} /></div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Add Item</button>
                </form>
              </div>
            </div>
          )}

          {showEditMenu && editItem && (
            <div className="modal-overlay" onClick={() => setShowEditMenu(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="flex-between mb-16"><h2>Edit Menu Item</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowEditMenu(false)}><FiX /></button></div>
                <form onSubmit={updateMenuItem}>
                  <div className="input-group"><label>Name</label><input className="input" required value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} /></div>
                  <div className="input-group"><label>Category</label><input className="input" required value={editItem.category} onChange={e => setEditItem({ ...editItem, category: e.target.value })} /></div>
                  <div className="input-group"><label>Price (₹)</label><input className="input" type="number" min="0" step="0.01" required value={editItem.price} onChange={e => setEditItem({ ...editItem, price: e.target.value })} /></div>
                  <div className="input-group"><label>Type</label>
                    <select className="input" value={editItem.isVeg} onChange={e => setEditItem({ ...editItem, isVeg: e.target.value === 'true' })}>
                      <option value="true">Veg</option><option value="false">Non-Veg</option>
                    </select>
                  </div>
                  <div className="input-group"><label>GST Category</label>
                    <select className="input" value={editItem.gstCategory} onChange={e => setEditItem({ ...editItem, gstCategory: e.target.value })}>
                      <option value="food_non_ac">Food (Non-AC) - 5%</option>
                      <option value="food_ac">Food (AC) - 5%</option>
                      <option value="beverage">Beverage - 18%</option>
                      <option value="alcohol">Alcohol - 28%</option>
                    </select>
                  </div>
                  <div className="input-group"><label>Prep Time (min)</label><input className="input" type="number" value={editItem.preparationTime} onChange={e => setEditItem({ ...editItem, preparationTime: e.target.value })} /></div>
                  <div className="input-group"><label>Description</label><textarea className="input" rows="2" value={editItem.description} onChange={e => setEditItem({ ...editItem, description: e.target.value })} /></div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}><FiSave /> Update Item</button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'network' && <NetworkTab />}

      {activeTab === 'system' && (
        <div className="grid-2">
          <div className="card">
            <h3 className="mb-16">Backup & Restore</h3>
            <p className="text-secondary mb-16">Create a backup of the database or restore from a previous backup.</p>
            <div className="flex gap-8">
              <button className="btn btn-primary" onClick={createBackup}><FiDownload /> Create Backup</button>
            </div>
          </div>
          <div className="card">
            <h3 className="mb-16">Notifications</h3>
            <p className="text-secondary mb-16">Send daily summary report via email.</p>
            <button className="btn btn-primary" onClick={sendReport}><FiMail /> Send Daily Report</button>
          </div>
          <div className="card">
            <h3 className="mb-16">Export Data</h3>
            <p className="text-secondary mb-16">Download all restaurant data as JSON. Use this to migrate to another system or keep an offline backup.</p>
            <button className="btn btn-primary" onClick={exportData}><FiDownload /> Export All Data (JSON)</button>
          </div>
          <div className="card">
            <h3 className="mb-16">Import Data</h3>
            <p className="text-secondary mb-16">Import data from a previously exported JSON file. Existing records are merged by ID.</p>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <FiUpload /> Import Data (JSON)
              <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;

// ─── Network & Sync Settings Tab ─────────────────────────
const NetworkTab = () => {
  const { mode, lanReachable, internetReachable } = useConnectionStatus();
  const [syncStatus, setSyncStatus] = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchSyncStatus();
    checkQueue();
    const interval = setInterval(() => { fetchSyncStatus(); checkQueue(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const res = await api.get('/sync/status');
      setSyncStatus(res.data);
    } catch { /* server unreachable */ }
  };

  const checkQueue = async () => {
    try {
      const queue = await getOfflineQueue();
      setQueueCount(queue.length);
    } catch { /* ignore */ }
  };

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      await fullSync();
      await fetchSyncStatus();
      await checkQueue();
      toast.success('Sync completed');
    } catch (err) {
      toast.error('Sync failed: ' + err.message);
    }
    setSyncing(false);
  };

  const handleClearQueue = async () => {
    if (window.confirm('Clear all pending offline operations? This data will be lost.')) {
      await clearOfflineQueue();
      setQueueCount(0);
      toast.success('Offline queue cleared');
    }
  };

  const handleRecheck = async () => {
    await connectionManager.recheckNow();
    toast.info('Connection re-checked');
  };

  const modeLabels = { online: 'Online (LAN + Internet)', lan: 'LAN Only', offline: 'Offline' };
  const modeColors = { online: '#10b981', lan: '#f59e0b', offline: '#ef4444' };

  return (
    <div>
      <div className="grid-2 mb-24">
        <div className="card">
          <h3 className="mb-16"><FiWifi style={{ marginRight: 8 }} />Connection Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex-between">
              <span>Current Mode</span>
              <span style={{ fontWeight: 700, color: modeColors[mode] }}>{modeLabels[mode]}</span>
            </div>
            <div className="flex-between">
              <span>LAN Server</span>
              <span className={`badge ${lanReachable ? 'badge-success' : 'badge-danger'}`}>{lanReachable ? 'Connected' : 'Unreachable'}</span>
            </div>
            <div className="flex-between">
              <span>Internet</span>
              <span className={`badge ${internetReachable ? 'badge-success' : 'badge-danger'}`}>{internetReachable ? 'Connected' : 'No Internet'}</span>
            </div>
            <div className="flex-between">
              <span>Server URL</span>
              <span className="text-secondary" style={{ fontSize: 13 }}>{connectionManager.getServerUrl()}</span>
            </div>
            <button className="btn btn-secondary mt-8" onClick={handleRecheck}><FiRefreshCw /> Re-check Connection</button>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-16"><FiCloud style={{ marginRight: 8 }} />Cloud Sync</h3>
          {syncStatus ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flex-between">
                <span>Cloud Sync</span>
                <span className={`badge ${syncStatus.syncEnabled ? 'badge-success' : 'badge-warning'}`}>
                  {syncStatus.syncEnabled ? 'Enabled' : 'Not Configured'}
                </span>
              </div>
              <div className="flex-between">
                <span>Cloud Database</span>
                <span className={`badge ${syncStatus.cloudConnected ? 'badge-success' : 'badge-danger'}`}>
                  {syncStatus.cloudConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex-between">
                <span>Last Sync</span>
                <span className="text-secondary" style={{ fontSize: 13 }}>
                  {syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString('en-IN') : 'Never'}
                </span>
              </div>
              {syncStatus.lastError && (
                <div className="flex-between">
                  <span>Last Error</span>
                  <span style={{ color: 'var(--danger)', fontSize: 12 }}>{syncStatus.lastError}</span>
                </div>
              )}
              {!syncStatus.syncEnabled && (
                <p className="text-muted" style={{ fontSize: 12 }}>
                  To enable cloud sync, set CLOUD_MONGODB_URI and SYNC_ENABLED=true in your .env file.
                  This lets you access POS data remotely from your phone.
                </p>
              )}
            </div>
          ) : (
            <p className="text-secondary">Unable to fetch sync status (server may be unreachable)</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-16">Offline Queue & Data Sync</h3>
        <div className="grid-3">
          <div className="stat-card">
            <div className="stat-value">{queueCount}</div>
            <div className="stat-label">Pending Operations</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: modeColors[mode] }}>{mode.toUpperCase()}</div>
            <div className="stat-label">Connection Mode</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{syncStatus?.lastSyncAt ? 'Active' : 'Idle'}</div>
            <div className="stat-label">Sync Status</div>
          </div>
        </div>
        <div className="flex gap-8 mt-16">
          <button className="btn btn-primary" onClick={handleForceSync} disabled={syncing || mode === 'offline'}>
            <FiRefreshCw className={syncing ? 'spinning' : ''} /> {syncing ? 'Syncing...' : 'Force Sync Now'}
          </button>
          {queueCount > 0 && (
            <button className="btn btn-danger" onClick={handleClearQueue}>Clear Offline Queue</button>
          )}
        </div>
        <p className="text-muted mt-8" style={{ fontSize: 12 }}>
          When offline, orders and changes are saved locally and auto-synced when connection returns.
          Use "Force Sync" to manually push/pull data.
        </p>
      </div>
    </div>
  );
};

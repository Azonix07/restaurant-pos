import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiShield, FiPlus, FiEdit2, FiTrash2, FiUsers, FiCheck, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './RoleManagement.css';

const PERMISSION_GROUPS = {
  'Billing': ['billing.create', 'billing.edit', 'billing.refund', 'billing.discount', 'billing.cancel', 'billing.reprint', 'billing.split', 'billing.hold'],
  'Orders': ['order.create', 'order.edit', 'order.cancel', 'order.view'],
  'KOT': ['kot.create', 'kot.edit', 'kot.delete', 'kot.view'],
  'Menu': ['menu.view', 'menu.create', 'menu.edit', 'menu.delete', 'menu.price_edit'],
  'Inventory': ['inventory.view', 'inventory.update', 'inventory.purchase', 'inventory.wastage'],
  'Stock': ['stock.view', 'stock.in', 'stock.out', 'stock.adjust'],
  'Reports': ['reports.view', 'reports.export', 'reports.sales', 'reports.inventory', 'reports.staff'],
  'Customers': ['customer.view', 'customer.create', 'customer.edit'],
  'Counter': ['counter.open', 'counter.close', 'counter.view'],
  'Tables': ['table.view', 'table.manage', 'table.transfer'],
  'Users': ['user.view', 'user.create', 'user.edit', 'user.deactivate'],
  'Settings': ['settings.view', 'settings.edit'],
  'Devices': ['device.view', 'device.manage', 'device.lock'],
  'Delivery': ['delivery.view', 'delivery.manage', 'delivery.assign'],
  'System': ['system.backup', 'system.restore', 'system.mode_change', 'system.lock'],
};

const RoleManagement = () => {
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(null);
  const [form, setForm] = useState({ name: '', displayName: '', description: '', permissions: [] });

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesRes, usersRes] = await Promise.all([
        api.get('/roles'),
        api.get('/auth/users'),
      ]);
      setRoles(rolesRes.data.roles || []);
      setUsers(usersRes.data.users || []);
    } catch (err) {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const openCreate = () => {
    setEditingRole(null);
    setForm({ name: '', displayName: '', description: '', permissions: [] });
    setShowModal(true);
  };

  const openEdit = (role) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      displayName: role.displayName,
      description: role.description || '',
      permissions: [...role.permissions],
    });
    setShowModal(true);
  };

  const togglePermission = (perm) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const toggleGroup = (group) => {
    const perms = PERMISSION_GROUPS[group];
    const allSelected = perms.every(p => form.permissions.includes(p));
    setForm(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !perms.includes(p))
        : [...new Set([...prev.permissions, ...perms])],
    }));
  };

  const handleSave = async () => {
    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole._id}`, form);
        toast.success('Role updated');
      } else {
        await api.post('/roles', form);
        toast.success('Role created');
      }
      setShowModal(false);
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save role');
    }
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`Delete role "${role.displayName}"?`)) return;
    try {
      await api.delete(`/roles/${role._id}`);
      toast.success('Role deactivated');
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete role');
    }
  };

  const handleAssign = async (userId) => {
    try {
      await api.post('/roles/assign', { userId, roleId: showAssignModal._id });
      toast.success('Role assigned');
      setShowAssignModal(null);
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assignment failed');
    }
  };

  if (loading) return <div className="role-loading">Loading roles...</div>;

  return (
    <div className="role-management">
      <div className="role-header">
        <div>
          <h1><FiShield /> Role Management</h1>
          <p className="role-subtitle">{roles.length} roles configured</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><FiPlus /> Create Role</button>
      </div>

      <div className="role-grid">
        {roles.map(role => (
          <div key={role._id} className={`role-card ${role.isSystem ? 'system' : ''}`}>
            <div className="role-card-header">
              <h3>{role.displayName}</h3>
              {role.isSystem && <span className="badge-system">System</span>}
            </div>
            <p className="role-desc">{role.description || 'No description'}</p>
            <div className="role-perm-count">
              <FiShield /> {role.permissions?.length || 0} permissions
            </div>
            <div className="role-perm-tags">
              {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => {
                const count = perms.filter(p => role.permissions?.includes(p)).length;
                if (count === 0) return null;
                return (
                  <span key={group} className={`perm-tag ${count === perms.length ? 'full' : 'partial'}`}>
                    {group} ({count}/{perms.length})
                  </span>
                );
              })}
            </div>
            <div className="role-actions">
              {!role.isSystem && (
                <>
                  <button className="btn-icon" onClick={() => openEdit(role)} title="Edit"><FiEdit2 /></button>
                  <button className="btn-icon danger" onClick={() => handleDelete(role)} title="Delete"><FiTrash2 /></button>
                </>
              )}
              <button className="btn-icon" onClick={() => setShowAssignModal(role)} title="Assign to user"><FiUsers /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <h2>{editingRole ? 'Edit Role' : 'Create Role'}</h2>

            <div className="form-row">
              <div className="form-group">
                <label>System Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                  placeholder="e.g. senior_cashier"
                  disabled={editingRole?.isSystem}
                />
              </div>
              <div className="form-group">
                <label>Display Name</label>
                <input
                  value={form.displayName}
                  onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                  placeholder="e.g. Senior Cashier"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="What this role does..."
              />
            </div>

            <h3 className="perm-title">Permissions ({form.permissions.length} selected)</h3>
            <div className="perm-grid">
              {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => {
                const allChecked = perms.every(p => form.permissions.includes(p));
                const someChecked = perms.some(p => form.permissions.includes(p));
                return (
                  <div key={group} className="perm-group">
                    <div className="perm-group-header" onClick={() => toggleGroup(group)}>
                      <span className={`perm-check ${allChecked ? 'checked' : someChecked ? 'partial' : ''}`}>
                        {allChecked ? <FiCheck /> : someChecked ? '−' : ''}
                      </span>
                      <strong>{group}</strong>
                    </div>
                    <div className="perm-items">
                      {perms.map(perm => (
                        <label key={perm} className="perm-item">
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(perm)}
                            onChange={() => togglePermission(perm)}
                          />
                          <span>{perm.split('.')[1]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={!form.name || !form.displayName}>
                {editingRole ? 'Update' : 'Create'} Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Role Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Assign "{showAssignModal.displayName}" Role</h2>
            <p className="assign-desc">Select a user to assign this role to:</p>
            <div className="user-assign-list">
              {users.filter(u => u.role !== 'admin').map(user => (
                <div key={user._id} className="user-assign-row">
                  <div>
                    <strong>{user.name}</strong>
                    <span className="user-role-badge">{user.customRole?.displayName || user.role}</span>
                  </div>
                  <button
                    className="btn-sm"
                    onClick={() => handleAssign(user._id)}
                    disabled={user.customRole?._id === showAssignModal._id}
                  >
                    {user.customRole?._id === showAssignModal._id ? <FiCheck /> : 'Assign'}
                  </button>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAssignModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;

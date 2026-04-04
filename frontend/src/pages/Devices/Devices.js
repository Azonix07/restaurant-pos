import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiMonitor, FiCheck, FiLock, FiUnlock, FiStar, FiTrash2, FiEdit2, FiWifi, FiWifiOff } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Devices.css';

const Devices = () => {
  const [devices, setDevices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', type: 'cashier_terminal', kitchenSection: '' });

  const fetchDevices = useCallback(async () => {
    try { const res = await api.get('/devices'); setDevices(res.data.devices); } catch (err) { toast.error('Load failed'); }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const approve = async (id) => {
    try { await api.patch(`/devices/${id}/approve`); toast.success('Device approved'); fetchDevices(); } catch (e) { toast.error('Failed'); }
  };

  const lock = async (id) => {
    const reason = prompt('Lock reason:');
    if (reason === null) return; // User cancelled
    try { await api.patch(`/devices/${id}/lock`, { reason: reason || 'Locked by admin' }); toast.success('Locked'); fetchDevices(); } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const unlock = async (id) => {
    try { await api.patch(`/devices/${id}/unlock`); toast.success('Unlocked'); fetchDevices(); } catch (e) { toast.error('Failed'); }
  };

  const setMaster = async (id) => {
    if (!window.confirm('Set this as the master device? The current master will be demoted.')) return;
    try { await api.patch(`/devices/${id}/set-master`); toast.success('Master set'); fetchDevices(); } catch (e) { toast.error('Failed'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this device?')) return;
    try { await api.delete(`/devices/${id}`); toast.success('Removed'); fetchDevices(); } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const startEdit = (d) => {
    setEditing(d._id);
    setEditForm({ name: d.name, type: d.type, kitchenSection: d.kitchenSection || '' });
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/devices/${id}`, editForm);
      toast.success('Updated');
      setEditing(null);
      fetchDevices();
    } catch (e) { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="page-header"><h1><FiMonitor /> Device Management</h1></div>
      <p className="text-secondary mb-16">Manage client PCs, waiter apps, and kitchen displays connected via LAN.</p>

      <table className="table">
        <thead><tr><th>Device</th><th>Type</th><th>IP</th><th>Status</th><th>Kitchen Section</th><th>Last Heartbeat</th><th>Actions</th></tr></thead>
        <tbody>
          {devices.map(d => (
            <tr key={d._id}>
              <td>
                {editing === d._id ? <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /> :
                  <><strong>{d.name}</strong>{d.isMaster && <span className="badge badge-primary ml-8"><FiStar /> MASTER</span>}</>}
              </td>
              <td>
                {editing === d._id ?
                  <select className="input" value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
                    <option value="master">Master</option><option value="cashier_terminal">Cashier</option><option value="waiter_app">Waiter App</option>
                    <option value="kitchen_display">Kitchen Display</option><option value="bar_display">Bar Display</option>
                  </select> : d.type}
              </td>
              <td>{d.ipAddress || '-'}</td>
              <td>
                {d.isLocked ? <span className="badge badge-danger"><FiLock /> Locked</span> :
                 d.status === 'online' ? <span className="badge badge-success"><FiWifi /> Online</span> :
                 !d.isApproved ? <span className="badge badge-warning">Pending</span> :
                 <span className="badge badge-secondary"><FiWifiOff /> Offline</span>}
              </td>
              <td>
                {editing === d._id ?
                  <select className="input" value={editForm.kitchenSection} onChange={e => setEditForm({ ...editForm, kitchenSection: e.target.value })}>
                    <option value="">None</option><option value="kitchen">Kitchen</option><option value="bakery">Bakery</option>
                    <option value="bar">Bar</option><option value="desserts">Desserts</option>
                  </select> : (d.kitchenSection || '-')}
              </td>
              <td>{d.lastHeartbeat ? new Date(d.lastHeartbeat).toLocaleString() : 'Never'}</td>
              <td>
                <div className="flex gap-4 flex-wrap">
                  {editing === d._id ? (
                    <>
                      <button className="btn btn-sm btn-success" onClick={() => saveEdit(d._id)}><FiCheck /></button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      {!d.isApproved && <button className="btn btn-sm btn-success" onClick={() => approve(d._id)}><FiCheck /> Approve</button>}
                      {d.isApproved && !d.isMaster && (
                        d.isLocked ?
                          <button className="btn btn-sm btn-success" onClick={() => unlock(d._id)}><FiUnlock /></button> :
                          <button className="btn btn-sm btn-warning" onClick={() => lock(d._id)}><FiLock /></button>
                      )}
                      {!d.isMaster && <button className="btn btn-sm btn-primary" onClick={() => setMaster(d._id)}><FiStar /></button>}
                      <button className="btn btn-sm btn-secondary" onClick={() => startEdit(d)}><FiEdit2 /></button>
                      {!d.isMaster && <button className="btn btn-sm btn-danger" onClick={() => remove(d._id)}><FiTrash2 /></button>}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {devices.length === 0 && <div className="empty-state"><p>No devices registered. Devices will appear here when they connect.</p></div>}
    </div>
  );
};

export default Devices;

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
import { FiPlus, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Tables.css';

const Tables = () => {
  const [tables, setTables] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ number: '', name: '', capacity: 4, section: 'Main' });
  const { hasRole } = useAuth();

  const fetchTables = async () => {
    try {
      const res = await api.get('/tables');
      setTables(res.data.tables || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchTables(); }, []);
  useSocket('table:update', () => fetchTables());

  const addTable = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tables', { ...form, number: parseInt(form.number, 10) });
      toast.success('Table added');
      setShowAdd(false);
      setForm({ number: '', name: '', capacity: 4, section: 'Main' });
      fetchTables();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/tables/${id}/status`, { status });
      fetchTables();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const statusColors = {
    available: 'var(--success)',
    occupied: 'var(--danger)',
    reserved: 'var(--warning)',
    cleaning: 'var(--info)',
  };

  const sections = [...new Set(tables.map(t => t.section))];

  return (
    <div>
      <div className="page-header">
        <h1>Tables</h1>
        {hasRole('admin', 'manager') && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <FiPlus /> Add Table
          </button>
        )}
      </div>

      <div className="table-legend mb-24">
        {Object.entries(statusColors).map(([status, color]) => (
          <span key={status} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            {status}
          </span>
        ))}
      </div>

      {sections.map(section => (
        <div key={section} className="mb-24">
          <h3 className="mb-16">{section}</h3>
          <div className="tables-grid">
            {tables.filter(t => t.section === section).map(table => (
              <div
                key={table._id}
                className="table-card"
                style={{ borderColor: statusColors[table.status] }}
              >
                <div className="table-number">{table.number}</div>
                <div className="table-name">{table.name}</div>
                <div className="table-capacity">{table.capacity} seats</div>
                <div className="table-status" style={{ color: statusColors[table.status] }}>
                  {table.status}
                </div>
                {table.currentOrder && (
                  <div className="table-order">Order active</div>
                )}
                <div className="table-actions">
                  {table.status === 'occupied' && (
                    <button className="btn btn-sm btn-warning" onClick={() => updateStatus(table._id, 'cleaning')}>Cleaning</button>
                  )}
                  {table.status === 'cleaning' && (
                    <button className="btn btn-sm btn-success" onClick={() => updateStatus(table._id, 'available')}>Available</button>
                  )}
                  {table.status === 'available' && (
                    <button className="btn btn-sm btn-primary" onClick={() => updateStatus(table._id, 'reserved')}>Reserve</button>
                  )}
                  {table.status === 'reserved' && (
                    <button className="btn btn-sm btn-success" onClick={() => updateStatus(table._id, 'available')}>Free</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-16">
              <h2>Add Table</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}><FiX /></button>
            </div>
            <form onSubmit={addTable}>
              <div className="input-group">
                <label>Table Number</label>
                <input className="input" type="number" required value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Name</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Capacity</label>
                <input className="input" type="number" min="1" required value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value, 10) })} />
              </div>
              <div className="input-group">
                <label>Section</label>
                <input className="input" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Add Table</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tables;

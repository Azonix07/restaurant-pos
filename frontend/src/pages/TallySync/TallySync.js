import React, { useState } from 'react';
import api from '../../services/api';
import { FiUpload, FiDownload, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';

const TallySync = () => {
  const [activeTab, setActiveTab] = useState('export');
  const [exportResult, setExportResult] = useState(null);
  const [exportRange, setExportRange] = useState({
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [selectedModules, setSelectedModules] = useState(['ledgers', 'vouchers', 'expenses', 'stockItems']);
  const [importForm, setImportForm] = useState({ ledgers: '', stockItems: '' });

  const handleExport = async () => {
    try {
      const res = await api.post('/tally/export', { ...exportRange, modules: selectedModules });
      setExportResult(res.data);
      toast.success(res.data.message);
    } catch (err) { toast.error('Export failed'); }
  };

  const downloadXml = () => {
    if (!exportResult?.tallyXml) return;
    const blob = new Blob([exportResult.tallyXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tally-export-${new Date().toISOString().split('T')[0]}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    try {
      const data = {};
      if (importForm.ledgers.trim()) {
        data.ledgers = importForm.ledgers.trim().split('\n').map(line => {
          const [name, parent, gstin, openingBalance] = line.split(',').map(s => s.trim());
          return { name, parent: parent || 'Sundry Debtors', gstin, openingBalance: Number(openingBalance) || 0 };
        });
      }
      if (importForm.stockItems.trim()) {
        data.stockItems = importForm.stockItems.trim().split('\n').map(line => {
          const [name, category, rate] = line.split(',').map(s => s.trim());
          return { name, category, rate: Number(rate) || 0 };
        });
      }
      const res = await api.post('/tally/import', data);
      toast.success(`Import complete: ${res.data.results.ledgers} ledgers, ${res.data.results.stockItems} stock items`);
    } catch (err) { toast.error('Import failed'); }
  };

  return (
    <div>
      <div className="page-header"><h1>Tally Integration</h1></div>

      <div className="report-tabs mb-24">
        <button className={`btn ${activeTab === 'export' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('export')}><FiDownload /> Export to Tally</button>
        <button className={`btn ${activeTab === 'import' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('import')}><FiUpload /> Import from Tally</button>
      </div>

      {activeTab === 'export' && (
        <div className="card">
          <h3 className="mb-16">Export Data to Tally</h3>
          <div className="grid-2 mb-16">
            <div className="input-group"><label>Start Date</label><input className="input" type="date" value={exportRange.startDate} onChange={e => setExportRange({ ...exportRange, startDate: e.target.value })} /></div>
            <div className="input-group"><label>End Date</label><input className="input" type="date" value={exportRange.endDate} onChange={e => setExportRange({ ...exportRange, endDate: e.target.value })} /></div>
          </div>
          <div className="mb-16">
            <label className="mb-8" style={{ display: 'block', fontWeight: 600 }}>Modules to Export</label>
            {['ledgers', 'vouchers', 'expenses', 'stockItems'].map(m => (
              <label key={m} className="flex gap-8 mb-4" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedModules.includes(m)} onChange={e => {
                  setSelectedModules(e.target.checked ? [...selectedModules, m] : selectedModules.filter(x => x !== m));
                }} />
                <span style={{ textTransform: 'capitalize' }}>{m.replace(/([A-Z])/g, ' $1')}</span>
              </label>
            ))}
          </div>
          <button className="btn btn-primary mb-16" onClick={handleExport}><FiDownload /> Generate Export</button>

          {exportResult && (
            <div>
              <div className="grid-4 mb-16">
                <div className="stat-card"><div className="stat-label">Ledgers</div><div className="stat-value">{exportResult.exportData?.ledgers?.length || 0}</div></div>
                <div className="stat-card"><div className="stat-label">Vouchers</div><div className="stat-value">{exportResult.exportData?.vouchers?.length || 0}</div></div>
                <div className="stat-card"><div className="stat-label">Expenses</div><div className="stat-value">{exportResult.exportData?.expenses?.length || 0}</div></div>
                <div className="stat-card"><div className="stat-label">Stock Items</div><div className="stat-value">{exportResult.exportData?.stockItems?.length || 0}</div></div>
              </div>
              <button className="btn btn-success" onClick={downloadXml}><FiDownload /> Download Tally XML</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'import' && (
        <div className="card">
          <h3 className="mb-16">Import Data from Tally</h3>
          <div className="input-group">
            <label>Ledgers (one per line: Name, Parent, GSTIN, Opening Balance)</label>
            <textarea className="input" rows="6" placeholder="ABC Traders, Sundry Debtors, 22AAAAA0000A1Z5, 50000" value={importForm.ledgers} onChange={e => setImportForm({ ...importForm, ledgers: e.target.value })} />
          </div>
          <div className="input-group">
            <label>Stock Items (one per line: Name, Category, Rate)</label>
            <textarea className="input" rows="6" placeholder="Widget A, Electronics, 500" value={importForm.stockItems} onChange={e => setImportForm({ ...importForm, stockItems: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={handleImport}><FiUpload /> Import to System</button>
        </div>
      )}
    </div>
  );
};

export default TallySync;

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import './GSTReports.css';

const GSTReports = () => {
  const [activeTab, setActiveTab] = useState('gstr1');
  const [gstr1, setGstr1] = useState(null);
  const [gstr3b, setGstr3b] = useState(null);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const fetchGSTR1 = async () => {
    try { const res = await api.get(`/gstr/gstr1?month=${month}&year=${year}`); setGstr1(res.data); } catch (err) { console.error(err); }
  };
  const fetchGSTR3B = async () => {
    try { const res = await api.get(`/gstr/gstr3b?month=${month}&year=${year}`); setGstr3b(res.data); } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (activeTab === 'gstr1') fetchGSTR1();
    else fetchGSTR3B();
  }, [activeTab, month, year]);

  return (
    <div>
      <div className="page-header">
        <h1>GST Reports</h1>
        <div className="flex gap-8">
          <select className="input" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value={year} onChange={e => setYear(e.target.value)}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="report-tabs mb-24">
        <button className={`btn ${activeTab === 'gstr1' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('gstr1')}>GSTR-1</button>
        <button className={`btn ${activeTab === 'gstr3b' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('gstr3b')}>GSTR-3B</button>
      </div>

      {activeTab === 'gstr1' && gstr1 && (
        <>
          <div className="grid-4 mb-24">
            <div className="stat-card"><div className="stat-label">B2B Invoices</div><div className="stat-value">{gstr1.b2b?.invoices || 0}</div></div>
            <div className="stat-card"><div className="stat-label">B2B Total</div><div className="stat-value">₹{(gstr1.b2b?.total || 0).toLocaleString('en-IN')}</div></div>
            <div className="stat-card"><div className="stat-label">B2C Orders + Invoices</div><div className="stat-value">{(gstr1.b2c?.orders || 0) + (gstr1.b2c?.invoices || 0)}</div></div>
            <div className="stat-card"><div className="stat-label">Total Taxable</div><div className="stat-value">₹{(gstr1.totalTaxableValue || 0).toLocaleString('en-IN')}</div></div>
          </div>

          {gstr1.b2b?.data?.length > 0 && (
            <div className="card mb-24">
              <h3 className="mb-16">B2B Invoices (With GSTIN)</h3>
              <table className="data-table">
                <thead><tr><th>Invoice #</th><th>Party</th><th>GSTIN</th><th>Total</th></tr></thead>
                <tbody>
                  {gstr1.b2b.data.map(inv => (
                    <tr key={inv._id}><td>{inv.invoiceNumber}</td><td>{inv.partyName || inv.party?.name}</td><td>{inv.partyGstin}</td><td>₹{inv.total?.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {gstr1.hsnSummary?.length > 0 && (
            <div className="card">
              <h3 className="mb-16">HSN Summary</h3>
              <table className="data-table">
                <thead><tr><th>HSN</th><th>Quantity</th><th>Taxable Value</th><th>GST</th></tr></thead>
                <tbody>
                  {gstr1.hsnSummary.map(h => (
                    <tr key={h.hsn}><td>{h.hsn}</td><td>{h.quantity}</td><td>₹{h.taxableValue?.toFixed(2)}</td><td>₹{h.gst?.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'gstr3b' && gstr3b && (
        <div className="card">
          <h3 className="mb-24">GSTR-3B Summary - {new Date(2000, parseInt(month) - 1, 1).toLocaleString('en', { month: 'long' })} {year}</h3>
          <div className="pl-section">
            <h4>3.1 Outward Supplies</h4>
            <div className="pl-row"><span>Taxable Value</span><span>₹{gstr3b.outwardSupplies?.taxableValue?.toLocaleString('en-IN')}</span></div>
            <div className="pl-row"><span>CGST</span><span>₹{gstr3b.outwardSupplies?.cgst?.toFixed(2)}</span></div>
            <div className="pl-row"><span>SGST</span><span>₹{gstr3b.outwardSupplies?.sgst?.toFixed(2)}</span></div>
            <div className="pl-row"><strong>Total Output GST</strong><strong>₹{gstr3b.outwardSupplies?.totalGST?.toFixed(2)}</strong></div>
          </div>
          <div className="pl-section">
            <h4>4. ITC Available</h4>
            <div className="pl-row"><span>Inward Taxable Value</span><span>₹{gstr3b.inwardSupplies?.taxableValue?.toLocaleString('en-IN')}</span></div>
            <div className="pl-row"><span>Input CGST</span><span>₹{gstr3b.inwardSupplies?.cgst?.toFixed(2)}</span></div>
            <div className="pl-row"><span>Input SGST</span><span>₹{gstr3b.inwardSupplies?.sgst?.toFixed(2)}</span></div>
            <div className="pl-row"><strong>Total ITC</strong><strong>₹{gstr3b.itcAvailable?.toFixed(2)}</strong></div>
          </div>
          <div className="pl-total">
            <span>Net GST Payable</span>
            <span style={{ color: gstr3b.netGSTPayable > 0 ? 'var(--danger)' : 'var(--success)' }}>₹{gstr3b.netGSTPayable?.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GSTReports;

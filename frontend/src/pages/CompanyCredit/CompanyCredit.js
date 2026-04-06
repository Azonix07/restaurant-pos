import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiChevronDown, FiChevronUp, FiSearch, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './CompanyCredit.css';

const CompanyCredit = () => {
  const [credits, setCredits] = useState([]);
  const [search, setSearch] = useState('');
  const [showSettled, setShowSettled] = useState(false);
  const [expandedCompany, setExpandedCompany] = useState(null);
  const [settleModal, setSettleModal] = useState(null);
  const [settleForm, setSettleForm] = useState({ amount: '', settlementRef: '' });
  const [totalDue, setTotalDue] = useState(0);

  const fetchCredits = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('companyName', search);
      params.append('settled', showSettled);
      const res = await api.get(`/orders/company-credit?${params.toString()}`);
      setCredits(res.data.companies || []);
      setTotalDue(res.data.totalDue || 0);
    } catch (err) {
      toast.error('Failed to load company credits');
    }
  }, [search, showSettled]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  const handleSettle = async () => {
    if (!settleForm.amount || Number(settleForm.amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await api.post(`/orders/${settleModal._id}/settle-credit`, {
        amount: Number(settleForm.amount),
        settlementRef: settleForm.settlementRef,
      });
      toast.success('Credit settled successfully');
      setSettleModal(null);
      setSettleForm({ amount: '', settlementRef: '' });
      fetchCredits();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Settlement failed');
    }
  };

  return (
    <div className="company-credit-page">
      <div className="page-header">
        <h1>Company Credit</h1>
      </div>

      <div className="grid-2 mb-24">
        <div className="stat-card"><div className="stat-label">Total Due</div><div className="stat-value" style={{ color: 'var(--danger)' }}>₹{totalDue.toLocaleString('en-IN')}</div></div>
        <div className="stat-card"><div className="stat-label">Companies</div><div className="stat-value">{credits.length}</div></div>
      </div>

      <div className="cc-filters mb-16">
        <div className="cc-search">
          <FiSearch className="cc-search-icon" />
          <input className="input" placeholder="Search company..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="cc-toggle">
          <input type="checkbox" checked={showSettled} onChange={e => setShowSettled(e.target.checked)} />
          <span>Show Settled</span>
        </label>
      </div>

      {credits.length === 0 ? (
        <div className="card text-center" style={{ padding: 60 }}>
          <p className="text-secondary">No company credits found</p>
        </div>
      ) : (
        credits.map(company => (
          <div key={company.companyName} className="card mb-12">
            <div className="cc-company-header" onClick={() => setExpandedCompany(expandedCompany === company.companyName ? null : company.companyName)}>
              <div>
                <strong>{company.companyName}</strong>
                <span className="text-secondary" style={{ marginLeft: 12 }}>{company.bills?.length || 0} bills</span>
              </div>
              <div className="flex gap-8" style={{ alignItems: 'center' }}>
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>₹{(company.totalDue || 0).toLocaleString('en-IN')}</span>
                {expandedCompany === company.companyName ? <FiChevronUp /> : <FiChevronDown />}
              </div>
            </div>
            {expandedCompany === company.companyName && (
              <div className="cc-bills">
                <table className="cc-table">
                  <thead>
                    <tr><th>Bill #</th><th>Amount</th><th>Due</th><th>Date</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {(company.bills || []).map(bill => (
                      <tr key={bill._id}>
                        <td>{bill.billNumber || bill.orderNumber}</td>
                        <td>₹{(bill.amount || 0).toLocaleString('en-IN')}</td>
                        <td style={{ color: bill.dueAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>₹{(bill.dueAmount || 0).toLocaleString('en-IN')}</td>
                        <td>{new Date(bill.date || bill.createdAt).toLocaleDateString('en-IN')}</td>
                        <td>
                          {bill.dueAmount > 0 && (
                            <button className="btn btn-sm btn-primary" onClick={() => { setSettleModal(bill); setSettleForm({ amount: bill.dueAmount, settlementRef: '' }); }}>Settle</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}

      {settleModal && (
        <div className="cc-modal-overlay" onClick={() => setSettleModal(null)}>
          <div className="cc-modal" onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-16">
              <h3>Settle Credit — #{settleModal.billNumber || settleModal.orderNumber}</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setSettleModal(null)}><FiX /></button>
            </div>
            <div className="mb-12">
              <label className="text-secondary" style={{ fontSize: 12 }}>Amount</label>
              <input className="input" type="number" value={settleForm.amount} onChange={e => setSettleForm(prev => ({ ...prev, amount: e.target.value }))} />
            </div>
            <div className="mb-16">
              <label className="text-secondary" style={{ fontSize: 12 }}>Settlement Reference</label>
              <input className="input" placeholder="e.g. cheque number, UTR..." value={settleForm.settlementRef} onChange={e => setSettleForm(prev => ({ ...prev, settlementRef: e.target.value }))} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSettle}>Confirm Settlement</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyCredit;

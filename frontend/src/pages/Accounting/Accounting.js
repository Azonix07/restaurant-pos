import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiPlus, FiX, FiTrash2, FiList, FiFileText, FiBookOpen } from 'react-icons/fi';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'react-toastify';
import './Accounting.css';

const EXPENSE_CATEGORIES = ['ingredients', 'salary', 'rent', 'utilities', 'maintenance', 'marketing', 'equipment', 'other'];
const COLORS = ['#6c5ce7', '#00cec9', '#fdcb6e', '#e17055', '#74b9ff', '#a29bfe', '#55efc4', '#fab1a0'];
const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];

const Accounting = () => {
  const [activeTab, setActiveTab] = useState('expenses');
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'ingredients', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Chart of Accounts state
  const [accounts, setAccounts] = useState([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({ code: '', name: '', type: 'asset', subType: '', description: '', openingBalance: 0 });

  // Journal Entries state
  const [journalEntries, setJournalEntries] = useState([]);
  const [showAddJournal, setShowAddJournal] = useState(false);
  const [journalForm, setJournalForm] = useState({
    date: new Date().toISOString().split('T')[0], narration: '',
    lines: [{ account: '', debit: 0, credit: 0, narration: '' }, { account: '', debit: 0, credit: 0, narration: '' }],
  });

  // Balance Sheet & Trial Balance state
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [trialBalance, setTrialBalance] = useState(null);

  // Account Statement state
  const [selectedAccount, setSelectedAccount] = useState('');
  const [accountStatement, setAccountStatement] = useState(null);

  const fetchExpenses = async () => {
    try { const res = await api.get(`/expenses?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`); setExpenses(res.data.expenses || []); } catch (err) { console.error(err); }
  };
  const fetchSummary = async () => {
    try { const res = await api.get(`/expenses/summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`); setSummary(res.data); } catch (err) { console.error(err); }
  };
  const fetchProfitLoss = async () => {
    try { const res = await api.get(`/reports/profit-loss?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`); setProfitLoss(res.data); } catch (err) { console.error(err); }
  };
  const fetchAccounts = async () => {
    try { const res = await api.get('/accounting/accounts'); setAccounts(res.data.accounts || []); } catch (err) { console.error(err); }
  };
  const fetchJournalEntries = async () => {
    try { const res = await api.get(`/accounting/journal?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`); setJournalEntries(res.data.entries || []); } catch (err) { console.error(err); }
  };
  const fetchBalanceSheet = async () => {
    try { const res = await api.get('/accounting/balance-sheet'); setBalanceSheet(res.data); } catch (err) { console.error(err); }
  };
  const fetchTrialBalance = async () => {
    try { const res = await api.get('/accounting/trial-balance'); setTrialBalance(res.data); } catch (err) { console.error(err); }
  };
  const fetchStatement = async (accId) => {
    try { const res = await api.get(`/accounting/statement/${accId}?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`); setAccountStatement(res.data); } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (activeTab === 'expenses') { fetchExpenses(); fetchSummary(); }
    else if (activeTab === 'profitLoss') fetchProfitLoss();
    else if (activeTab === 'accounts') fetchAccounts();
    else if (activeTab === 'journal') { fetchJournalEntries(); fetchAccounts(); }
    else if (activeTab === 'balanceSheet') fetchBalanceSheet();
    else if (activeTab === 'trialBalance') fetchTrialBalance();
    else if (activeTab === 'statement') fetchAccounts();
  }, [activeTab, dateRange]);

  const addExpense = async (e) => {
    e.preventDefault();
    try { await api.post('/expenses', { ...form, amount: parseFloat(form.amount) }); toast.success('Expense added'); setShowAdd(false); setForm({ title: '', category: 'ingredients', amount: '', description: '', date: new Date().toISOString().split('T')[0] }); fetchExpenses(); fetchSummary(); } catch (err) { toast.error('Failed to add expense'); }
  };
  const deleteExpense = async (id) => {
    try { await api.delete(`/expenses/${id}`); toast.success('Expense deleted'); fetchExpenses(); fetchSummary(); } catch (err) { toast.error('Failed'); }
  };

  const addAccount = async (e) => {
    e.preventDefault();
    try { await api.post('/accounting/accounts', accountForm); toast.success('Account created'); setShowAddAccount(false); setAccountForm({ code: '', name: '', type: 'asset', subType: '', description: '', openingBalance: 0 }); fetchAccounts(); } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const addJournalEntry = async (e) => {
    e.preventDefault();
    const totalDebit = journalForm.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = journalForm.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) { toast.error('Debits must equal credits'); return; }
    try {
      await api.post('/accounting/journal', journalForm);
      toast.success('Journal entry created');
      setShowAddJournal(false);
      setJournalForm({ date: new Date().toISOString().split('T')[0], narration: '', lines: [{ account: '', debit: 0, credit: 0, narration: '' }, { account: '', debit: 0, credit: 0, narration: '' }] });
      fetchJournalEntries();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const updateJournalLine = (idx, field, value) => {
    const lines = [...journalForm.lines];
    lines[idx][field] = field === 'account' || field === 'narration' ? value : Number(value);
    setJournalForm({ ...journalForm, lines });
  };

  const addJournalLine = () => setJournalForm({ ...journalForm, lines: [...journalForm.lines, { account: '', debit: 0, credit: 0, narration: '' }] });

  const pieData = summary?.summary?.map(s => ({ name: s._id, value: s.total })) || [];

  const tabs = [
    { id: 'expenses', label: 'Expenses' },
    { id: 'profitLoss', label: 'Profit & Loss' },
    { id: 'accounts', label: 'Chart of Accounts' },
    { id: 'journal', label: 'Journal Entries' },
    { id: 'statement', label: 'Account Statement' },
    { id: 'balanceSheet', label: 'Balance Sheet' },
    { id: 'trialBalance', label: 'Trial Balance' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Accounting</h1>
        <div className="flex gap-8">
          <input type="date" className="input" style={{ width: 'auto' }} value={dateRange.startDate} onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))} />
          <input type="date" className="input" style={{ width: 'auto' }} value={dateRange.endDate} onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))} />
        </div>
      </div>

      <div className="report-tabs mb-24" style={{ flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button key={tab.id} className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Expenses Tab ─── */}
      {activeTab === 'expenses' && (
        <>
          <div className="grid-2 mb-24">
            <div className="card">
              <div className="flex-between mb-16"><h3>Expense Summary</h3><strong>₹{summary?.grandTotal?.toLocaleString('en-IN') || 0}</strong></div>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart><Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ₹${value}`}>{pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}</Pie><Tooltip formatter={(v) => `₹${v}`} /></PieChart>
                </ResponsiveContainer>
              ) : <p className="text-secondary text-center">No expenses recorded</p>}
            </div>
            <div className="card">
              <h3 className="mb-16">By Category</h3>
              {summary?.summary?.map((s, idx) => (
                <div key={s._id} className="flex-between mb-8">
                  <div className="flex gap-8" style={{ alignItems: 'center' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS[idx % COLORS.length], display: 'inline-block' }} />
                    <span className="text-secondary" style={{ textTransform: 'capitalize' }}>{s._id}</span>
                  </div>
                  <strong>₹{s.total?.toLocaleString('en-IN')}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="flex-between mb-16"><h3>All Expenses</h3><button className="btn btn-primary" onClick={() => setShowAdd(true)}><FiPlus /> Add Expense</button></div>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {expenses.map(exp => (
                  <tr key={exp._id}>
                    <td>{new Date(exp.date).toLocaleDateString('en-IN')}</td><td>{exp.title}</td>
                    <td style={{ textTransform: 'capitalize' }}>{exp.category}</td><td>₹{exp.amount?.toLocaleString('en-IN')}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => deleteExpense(exp._id)}><FiTrash2 /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── Profit & Loss Tab ─── */}
      {activeTab === 'profitLoss' && profitLoss && (
        <div className="card">
          <h3 className="mb-24">Profit & Loss Statement</h3>
          <div className="pl-section"><h4>Revenue</h4>
            <div className="pl-row"><span>Total Revenue</span><span className="pl-amount">₹{profitLoss.totalRevenue?.toLocaleString('en-IN')}</span></div>
            <div className="pl-row"><span>GST Collected</span><span className="pl-amount">₹{profitLoss.totalGST?.toLocaleString('en-IN')}</span></div>
            <div className="pl-row"><span>Discounts Given</span><span className="pl-amount danger">-₹{profitLoss.totalDiscounts?.toLocaleString('en-IN')}</span></div>
          </div>
          <div className="pl-section"><h4>Expenses</h4>
            {Object.entries(profitLoss.expenseByCategory || {}).map(([cat, amt]) => (
              <div key={cat} className="pl-row"><span style={{ textTransform: 'capitalize' }}>{cat}</span><span className="pl-amount danger">-₹{amt?.toLocaleString('en-IN')}</span></div>
            ))}
            <div className="pl-row"><strong>Total Expenses</strong><strong className="pl-amount danger">-₹{profitLoss.totalExpenses?.toLocaleString('en-IN')}</strong></div>
          </div>
          <div className="pl-total"><span>Net Profit</span><span style={{ color: profitLoss.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>₹{profitLoss.netProfit?.toLocaleString('en-IN')}</span></div>
        </div>
      )}

      {/* ─── Chart of Accounts Tab ─── */}
      {activeTab === 'accounts' && (
        <div className="card">
          <div className="flex-between mb-16"><h3>Chart of Accounts</h3><button className="btn btn-primary" onClick={() => setShowAddAccount(true)}><FiPlus /> Add Account</button></div>
          {ACCOUNT_TYPES.map(type => {
            const typeAccounts = accounts.filter(a => a.type === type);
            if (typeAccounts.length === 0) return null;
            return (
              <div key={type} className="mb-24">
                <h4 className="mb-8" style={{ textTransform: 'capitalize', color: 'var(--accent)' }}>{type} Accounts</h4>
                <table className="data-table">
                  <thead><tr><th>Code</th><th>Name</th><th>Sub Type</th><th>Balance</th></tr></thead>
                  <tbody>
                    {typeAccounts.map(acc => (
                      <tr key={acc._id}>
                        <td><strong>{acc.code}</strong></td><td>{acc.name}</td>
                        <td>{acc.subType || '-'}</td>
                        <td style={{ color: acc.currentBalance >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>₹{acc.currentBalance?.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {accounts.length === 0 && <p className="text-secondary text-center">No accounts. Create your chart of accounts to get started.</p>}
        </div>
      )}

      {/* ─── Journal Entries Tab ─── */}
      {activeTab === 'journal' && (
        <div className="card">
          <div className="flex-between mb-16"><h3>Journal Entries</h3><button className="btn btn-primary" onClick={() => setShowAddJournal(true)}><FiPlus /> New Entry</button></div>
          <table className="data-table">
            <thead><tr><th>#</th><th>Date</th><th>Narration</th><th>Debit</th><th>Credit</th><th>By</th></tr></thead>
            <tbody>
              {journalEntries.map(entry => (
                <tr key={entry._id}>
                  <td>{entry.entryNumber}</td>
                  <td>{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                  <td>{entry.narration || '-'}<br />
                    <span className="text-secondary" style={{ fontSize: 11 }}>
                      {entry.lines?.map(l => `${l.account?.name || 'Unknown'}: Dr ${l.debit} / Cr ${l.credit}`).join('; ')}
                    </span>
                  </td>
                  <td>₹{entry.lines?.reduce((s, l) => s + (l.debit || 0), 0).toLocaleString('en-IN')}</td>
                  <td>₹{entry.lines?.reduce((s, l) => s + (l.credit || 0), 0).toLocaleString('en-IN')}</td>
                  <td>{entry.createdBy?.name || '-'}</td>
                </tr>
              ))}
              {journalEntries.length === 0 && <tr><td colSpan="6" className="text-center text-secondary">No journal entries</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Account Statement Tab ─── */}
      {activeTab === 'statement' && (
        <div className="card">
          <h3 className="mb-16">Account Statement</h3>
          <div className="flex gap-8 mb-16">
            <select className="input" style={{ width: 300 }} value={selectedAccount} onChange={e => { setSelectedAccount(e.target.value); if (e.target.value) fetchStatement(e.target.value); }}>
              <option value="">Select Account</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          {accountStatement && (
            <>
              <div className="flex-between mb-16">
                <h4>{accountStatement.account?.name}</h4>
                <strong>Closing Balance: ₹{accountStatement.closingBalance?.toLocaleString('en-IN')}</strong>
              </div>
              <table className="data-table">
                <thead><tr><th>Date</th><th>Entry #</th><th>Narration</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
                <tbody>
                  {accountStatement.statement?.map((s, idx) => (
                    <tr key={idx}>
                      <td>{new Date(s.date).toLocaleDateString('en-IN')}</td>
                      <td>{s.entryNumber}</td><td>{s.narration || '-'}</td>
                      <td>{s.debit ? `₹${s.debit.toLocaleString('en-IN')}` : '-'}</td>
                      <td>{s.credit ? `₹${s.credit.toLocaleString('en-IN')}` : '-'}</td>
                      <td>₹{s.balance?.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {(!accountStatement.statement || accountStatement.statement.length === 0) && <tr><td colSpan="6" className="text-center text-secondary">No transactions</td></tr>}
                </tbody>
              </table>
            </>
          )}
          {!accountStatement && <p className="text-secondary text-center">Select an account to view the statement</p>}
        </div>
      )}

      {/* ─── Balance Sheet Tab ─── */}
      {activeTab === 'balanceSheet' && (
        <div className="card">
          <div className="flex-between mb-24">
            <h3>Balance Sheet</h3>
            {balanceSheet && <span className={`badge ${balanceSheet.isBalanced ? 'badge-completed' : 'badge-cancelled'}`}>{balanceSheet.isBalanced ? 'Balanced ✓' : 'Not Balanced ✗'}</span>}
          </div>
          {balanceSheet ? (
            <div className="grid-2">
              <div>
                <h4 style={{ color: 'var(--accent)' }} className="mb-8">Assets</h4>
                {balanceSheet.assets?.map(a => <div key={a.code} className="pl-row"><span>{a.code} - {a.name}</span><span>₹{a.balance?.toLocaleString('en-IN')}</span></div>)}
                <div className="pl-row" style={{ borderTop: '2px solid var(--border)', marginTop: 8, paddingTop: 8 }}><strong>Total Assets</strong><strong>₹{balanceSheet.totalAssets?.toLocaleString('en-IN')}</strong></div>
              </div>
              <div>
                <h4 style={{ color: 'var(--warning)' }} className="mb-8">Liabilities</h4>
                {balanceSheet.liabilities?.map(a => <div key={a.code} className="pl-row"><span>{a.code} - {a.name}</span><span>₹{a.balance?.toLocaleString('en-IN')}</span></div>)}
                <h4 style={{ color: 'var(--success)' }} className="mb-8 mt-16">Equity</h4>
                {balanceSheet.equity?.map(a => <div key={a.code} className="pl-row"><span>{a.code} - {a.name}</span><span>₹{a.balance?.toLocaleString('en-IN')}</span></div>)}
                <div className="pl-row"><span>Retained Earnings</span><span>₹{balanceSheet.retainedEarnings?.toLocaleString('en-IN')}</span></div>
                <div className="pl-row" style={{ borderTop: '2px solid var(--border)', marginTop: 8, paddingTop: 8 }}><strong>Total Liabilities + Equity</strong><strong>₹{balanceSheet.totalEquity?.toLocaleString('en-IN')}</strong></div>
              </div>
            </div>
          ) : <p className="text-secondary text-center">Loading...</p>}
        </div>
      )}

      {/* ─── Trial Balance Tab ─── */}
      {activeTab === 'trialBalance' && (
        <div className="card">
          <div className="flex-between mb-16">
            <h3>Trial Balance</h3>
            {trialBalance && <span className={`badge ${trialBalance.isBalanced ? 'badge-completed' : 'badge-cancelled'}`}>{trialBalance.isBalanced ? 'Balanced ✓' : 'Not Balanced ✗'}</span>}
          </div>
          {trialBalance ? (
            <table className="data-table">
              <thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Debit (₹)</th><th>Credit (₹)</th></tr></thead>
              <tbody>
                {trialBalance.trialBalance?.map(a => (
                  <tr key={a.code}><td>{a.code}</td><td>{a.name}</td><td style={{ textTransform: 'capitalize' }}>{a.type}</td>
                    <td>{a.debit ? a.debit.toLocaleString('en-IN') : '-'}</td><td>{a.credit ? a.credit.toLocaleString('en-IN') : '-'}</td></tr>
                ))}
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td colSpan="3">Total</td>
                  <td>₹{trialBalance.totalDebit?.toLocaleString('en-IN')}</td>
                  <td>₹{trialBalance.totalCredit?.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          ) : <p className="text-secondary text-center">Loading...</p>}
        </div>
      )}

      {/* ─── Add Expense Modal ─── */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-16"><h2>Add Expense</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}><FiX /></button></div>
            <form onSubmit={addExpense}>
              <div className="input-group"><label>Title</label><input className="input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div className="input-group"><label>Category</label><select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="input-group"><label>Amount (₹)</label><input className="input" type="number" min="0" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="input-group"><label>Date</label><input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div className="input-group"><label>Description</label><textarea className="input" rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Add Expense</button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Add Account Modal ─── */}
      {showAddAccount && (
        <div className="modal-overlay" onClick={() => setShowAddAccount(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-16"><h2>Add Account</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowAddAccount(false)}><FiX /></button></div>
            <form onSubmit={addAccount}>
              <div className="input-group"><label>Code</label><input className="input" required value={accountForm.code} onChange={e => setAccountForm({ ...accountForm, code: e.target.value })} placeholder="e.g. 1001" /></div>
              <div className="input-group"><label>Name</label><input className="input" required value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} /></div>
              <div className="input-group"><label>Type</label>
                <select className="input" value={accountForm.type} onChange={e => setAccountForm({ ...accountForm, type: e.target.value })}>
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="input-group"><label>Sub Type</label><input className="input" value={accountForm.subType} onChange={e => setAccountForm({ ...accountForm, subType: e.target.value })} placeholder="e.g. bank, cash, current_asset" /></div>
              <div className="input-group"><label>Opening Balance (₹)</label><input className="input" type="number" value={accountForm.openingBalance} onChange={e => setAccountForm({ ...accountForm, openingBalance: Number(e.target.value) })} /></div>
              <div className="input-group"><label>Description</label><textarea className="input" rows="2" value={accountForm.description} onChange={e => setAccountForm({ ...accountForm, description: e.target.value })} /></div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Account</button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Add Journal Entry Modal ─── */}
      {showAddJournal && (
        <div className="modal-overlay" onClick={() => setShowAddJournal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="flex-between mb-16"><h2>New Journal Entry</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowAddJournal(false)}><FiX /></button></div>
            <form onSubmit={addJournalEntry}>
              <div className="grid-2 mb-16">
                <div className="input-group"><label>Date</label><input className="input" type="date" value={journalForm.date} onChange={e => setJournalForm({ ...journalForm, date: e.target.value })} /></div>
                <div className="input-group"><label>Narration</label><input className="input" value={journalForm.narration} onChange={e => setJournalForm({ ...journalForm, narration: e.target.value })} /></div>
              </div>
              <table className="data-table mb-8">
                <thead><tr><th>Account</th><th>Debit (₹)</th><th>Credit (₹)</th><th>Narration</th><th></th></tr></thead>
                <tbody>
                  {journalForm.lines.map((line, idx) => (
                    <tr key={idx}>
                      <td><select className="input" value={line.account} onChange={e => updateJournalLine(idx, 'account', e.target.value)} required>
                        <option value="">Select Account</option>
                        {accounts.map(a => <option key={a._id} value={a._id}>{a.code} - {a.name}</option>)}
                      </select></td>
                      <td><input className="input" type="number" min="0" style={{ width: 100 }} value={line.debit} onChange={e => updateJournalLine(idx, 'debit', e.target.value)} /></td>
                      <td><input className="input" type="number" min="0" style={{ width: 100 }} value={line.credit} onChange={e => updateJournalLine(idx, 'credit', e.target.value)} /></td>
                      <td><input className="input" value={line.narration} onChange={e => updateJournalLine(idx, 'narration', e.target.value)} /></td>
                      <td>{journalForm.lines.length > 2 && <button type="button" className="btn btn-danger btn-sm" onClick={() => setJournalForm({ ...journalForm, lines: journalForm.lines.filter((_, i) => i !== idx) })}><FiX /></button>}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 'bold' }}>
                    <td>Total</td>
                    <td>₹{journalForm.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)}</td>
                    <td>₹{journalForm.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)}</td>
                    <td colSpan="2"></td>
                  </tr>
                </tbody>
              </table>
              <button type="button" className="btn btn-secondary btn-sm mb-16" onClick={addJournalLine}><FiPlus /> Add Line</button>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Journal Entry</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounting;

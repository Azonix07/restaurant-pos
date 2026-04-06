import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FiMessageSquare, FiX, FiSend, FiTrash2, FiKey, FiCpu, FiUser } from 'react-icons/fi';
import api from '../../services/api';
import './AIChatWidget.css';

const AI_API_URL = 'https://api.anthropic.com/v1/messages';

const SUGGESTIONS = [
  "What's today's revenue?",
  'Top selling items?',
  'Any fraud alerts?',
  'Table occupancy now?',
  'Staff performance today?',
];

const getApiKey = () => localStorage.getItem('claude_api_key') || '';
const setApiKeyLS = (key) => {
  if (key) localStorage.setItem('claude_api_key', key);
  else localStorage.removeItem('claude_api_key');
};

async function gatherContext(query) {
  const ctx = {};
  const q = query.toLowerCase();
  const safeFetch = async (path) => {
    try { return (await api.get(path)).data; } catch { return null; }
  };

  ctx.dailySummary = await safeFetch('/reports/daily');

  if (/order|sale|revenue|today/.test(q)) {
    ctx.activeOrders = await safeFetch('/orders/active');
    ctx.salesHistory = await safeFetch('/orders/sales-history?limit=20');
  }
  if (/menu|item|dish|food|popular|sell/.test(q)) {
    ctx.menuItems = await safeFetch('/menu');
    ctx.itemSales = await safeFetch('/reports/items');
  }
  if (/table|seat|occupan/.test(q)) {
    ctx.tables = await safeFetch('/tables');
  }
  if (/staff|waiter|employee|perform/.test(q)) {
    ctx.staffPerformance = await safeFetch('/reports/staff-performance');
  }
  if (/tax|gst/.test(q)) {
    ctx.taxReport = await safeFetch('/reports/tax');
  }
  if (/peak|busy|rush/.test(q)) {
    ctx.peakHours = await safeFetch('/reports/peak-hours');
  }
  if (/profit|loss|expense/.test(q)) {
    ctx.profitLoss = await safeFetch('/reports/profit-loss');
  }
  if (/alert|fraud|monitor|issue/.test(q)) {
    ctx.alerts = await safeFetch('/monitoring/alerts');
    ctx.dashboard = await safeFetch('/monitoring/dashboard');
  }
  if (/customer/.test(q)) {
    ctx.customers = await safeFetch('/customers?limit=20');
  }
  if (/inventory|stock/.test(q)) {
    ctx.inventory = await safeFetch('/inventory');
  }
  if (/expense|cost/.test(q)) {
    ctx.expenses = await safeFetch('/expenses?limit=20');
  }

  Object.keys(ctx).forEach(k => { if (!ctx[k]) delete ctx[k]; });
  return ctx;
}

async function chatWithClaude(userMessage, history) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API key not set. Click the key icon to add it.');

  const context = await gatherContext(userMessage);

  const systemPrompt = `You are the AI assistant for a Restaurant POS system. You help the admin with:
- Sales data, revenue, trends analysis
- Menu performance and item popularity
- Staff performance tracking
- Table occupancy and management
- Expense tracking and profit/loss
- Tax and GST reports
- Fraud alerts and monitoring
- Inventory and stock management
- Customer insights
- Actionable business recommendations

This POS system has these features: Orders, Tables, Billing (ESC/POS thermal printing, HTML bills), KOT (Kitchen Order Tickets with section routing), Kitchen Display, Counter/Shift management, Customers, Held Orders, Refunds (with PIN approval), Token Queue, Inventory with BOM, Stock Management, Production batches, Wastage tracking, Barcode management, Suppliers & Purchase orders, Invoices, Parties, Accounting (journal entries, chart of accounts), Reports (daily/weekly/monthly), Sales History, Company Credit, GST Reports, Fixed Assets, External Orders (Swiggy/Zomato), QR Ordering, System Modes (Rush/Test/Beginner/Advanced), Fraud Dashboard (auto-detection), Staff Analysis, Backup (auto every 4h), Device Management, Companies, Tally Sync, Audit Trail, Recycle Bin, WhatsApp integration, Delivery system, and this AI Assistant.

You have access to real-time data. Format responses with bullet points, use ₹ (INR). Be concise and helpful.

Current data:
${JSON.stringify(context)}`;

  const messages = [];
  const recent = history.slice(-8);
  for (const msg of recent) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: 'user', content: userMessage });

  const res = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1536,
      system: systemPrompt,
      messages,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    return data.content?.[0]?.text || 'No response.';
  } else {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `API error (${res.status})`);
  }
}

const AIChatWidget = () => {
  const { hasRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(!!getApiKey());
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const bodyRef = useRef(null);

  // Only show for admin/manager
  if (!hasRole('admin') && !hasRole('manager')) return null;

  const scrollToBottom = () => {
    setTimeout(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
      }
    }, 50);
  };

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput('');
    const updated = [...messages, { role: 'user', content: msg }];
    setMessages(updated);
    setLoading(true);
    scrollToBottom();

    try {
      const reply = await chatWithClaude(msg, updated);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    }
    setLoading(false);
    scrollToBottom();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const saveKey = () => {
    if (keyInput.trim()) {
      setApiKeyLS(keyInput.trim());
      setHasKey(true);
      setShowKeyForm(false);
      setKeyInput('');
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button className="ai-fab" onClick={() => setIsOpen(true)} title="AI Assistant">
          <span className="ai-fab-pulse" />
          <FiMessageSquare size={24} />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="ai-chat-panel">
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-chat-header-icon">✨</div>
            <div className="ai-chat-header-info">
              <h3>AI Assistant</h3>
              <span>Powered by Claude</span>
            </div>
            <div className="ai-chat-header-actions">
              <button onClick={() => setShowKeyForm(!showKeyForm)} title="API Key">
                <FiKey size={14} style={{ color: hasKey ? '#86efac' : 'rgba(255,255,255,0.6)' }} />
              </button>
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} title="Clear chat">
                  <FiTrash2 size={14} />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} title="Close">
                <FiX size={16} />
              </button>
            </div>
          </div>

          {/* Key Form */}
          {showKeyForm ? (
            <div className="ai-chat-body">
              <div className="ai-chat-key-form">
                <h4>🔑 Claude API Key</h4>
                <p>Stored locally in your browser only. Get your key from console.anthropic.com</p>
                <input
                  type="password"
                  placeholder="sk-ant-..."
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveKey()}
                />
                <div className="ai-chat-key-form-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowKeyForm(false)}>Cancel</button>
                  {hasKey && (
                    <button className="btn btn-danger btn-sm" onClick={() => { setApiKeyLS(null); setHasKey(false); setShowKeyForm(false); }}>Remove</button>
                  )}
                  <button className="btn btn-primary btn-sm" onClick={saveKey}>Save Key</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Body */}
              <div className="ai-chat-body" ref={bodyRef}>
                {!hasKey && (
                  <div className="ai-chat-key-warning">
                    <span>⚠️ API key required to use AI</span>
                    <button onClick={() => setShowKeyForm(true)}>Add Key</button>
                  </div>
                )}
                {messages.length === 0 ? (
                  <div className="ai-chat-welcome">
                    <div className="ai-chat-welcome-icon">✨</div>
                    <h4>How can I help?</h4>
                    <p>Ask about sales, orders, staff, inventory, or anything about your restaurant.</p>
                    <div className="ai-chat-suggestions">
                      {SUGGESTIONS.map((s, i) => (
                        <button key={i} className="ai-chat-suggestion" onClick={() => sendMessage(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => (
                      <div key={i} className={`ai-chat-msg ${msg.role}`}>
                        <div className="ai-chat-msg-avatar">
                          {msg.role === 'assistant' ? <FiCpu size={14} /> : <FiUser size={14} />}
                        </div>
                        <div className="ai-chat-msg-bubble">{msg.content}</div>
                      </div>
                    ))}
                    {loading && (
                      <div className="ai-chat-typing">
                        <div className="ai-chat-msg-avatar" style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiCpu size={14} />
                        </div>
                        <div className="ai-chat-typing-bubble">
                          <div className="ai-chat-typing-dots">
                            <span /><span /><span />
                          </div>
                          <span className="ai-chat-typing-text">Analyzing...</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Input */}
              <div className="ai-chat-input">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything..."
                  disabled={loading}
                />
                <button className="ai-chat-send" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
                  <FiSend size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default AIChatWidget;

import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FiKey, FiTrash2, FiSend, FiCpu, FiUser, FiAlertTriangle } from 'react-icons/fi';
import './AIAssistant.css';

const SUGGESTIONS = [
  "What's today's revenue summary?",
  'Which are the top 5 selling items?',
  'How is staff performance today?',
  'Show me peak hour analysis',
  'Any fraud alerts or issues?',
  'What is the current table occupancy?',
  'Give me a profit & loss overview',
  'Which items should I promote more?',
];

const AI_API_URL = 'https://api.anthropic.com/v1/messages';

const getApiKey = () => localStorage.getItem('claude_api_key') || '';
const setApiKey = (key) => {
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
  if (/menu|item|dish|food|popular/.test(q)) {
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

  // Remove null entries
  Object.keys(ctx).forEach(k => { if (!ctx[k]) delete ctx[k]; });
  return ctx;
}

async function chatWithClaude(userMessage, history) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Claude API key not set. Click the key icon to add your key.');

  const context = await gatherContext(userMessage);

  const systemPrompt = `You are an AI assistant for a restaurant POS system. You help the admin/manager with:
- Analyzing sales data, revenue, and trends
- Menu performance and item popularity
- Staff performance tracking
- Table occupancy and management
- Expense tracking and profit/loss analysis
- Tax and GST reports
- Fraud alerts and monitoring
- Inventory and stock management
- Customer insights
- Actionable business recommendations

You have access to real-time data from the restaurant's backend system.
Format your responses clearly with bullet points and numbers where appropriate.
Use ₹ (INR) for currency. Keep responses concise and actionable.
If you don't have enough data to answer, say so clearly.

Current restaurant data context:
${JSON.stringify(context)}`;

  const messages = [];
  const recent = history.slice(-10);
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
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    return data.content?.[0]?.text || 'No response from Claude.';
  } else {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Claude API error (${res.status})`);
  }
}

const AIAssistant = () => {
  const { hasRole } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [hasKey, setHasKey] = useState(!!getApiKey());
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    if (!hasRole('admin', 'manager')) return;

    setInput('');
    const updatedMessages = [...messages, { role: 'user', content: msg }];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const reply = await chatWithClaude(msg, updatedMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="ai-assistant">
      <div className="ai-header">
        <div className="ai-header-left">
          <div className="ai-logo">✨</div>
          <div>
            <h2>AI Assistant</h2>
            <p>Powered by Claude AI</p>
          </div>
        </div>
        <div className="ai-header-actions">
          <button onClick={() => setShowKeyModal(true)}>
            <FiKey style={{ color: hasKey ? '#22c55e' : '#9ca3af' }} />
            API Key
          </button>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])}>
              <FiTrash2 /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="ai-body" ref={bodyRef}>
        {messages.length === 0 ? (
          <div className="ai-welcome">
            <div className="ai-welcome-icon">✨</div>
            <h3>Restaurant AI Assistant</h3>
            <p>Ask anything about your restaurant — sales, menu, staff, inventory, and more.</p>

            {!hasKey && (
              <div className="ai-key-warning">
                <FiAlertTriangle color="#f59e0b" size={20} />
                <span>API key required. Click the key button above to add your Claude API key.</span>
              </div>
            )}

            <p className="ai-suggestions-label">Try asking:</p>
            <div className="ai-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="ai-suggestion-chip" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="ai-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`ai-message ${msg.role}`}>
                <div className="ai-message-avatar">
                  {msg.role === 'assistant' ? <FiCpu /> : <FiUser />}
                </div>
                <div className="ai-message-bubble">{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className="ai-message assistant">
                <div className="ai-message-avatar"><FiCpu /></div>
                <div className="ai-typing">
                  <div className="ai-typing-spinner" />
                  <span>Analyzing...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ai-input-area">
        <div className="ai-input-row">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your restaurant..."
            disabled={loading}
          />
          <button className="ai-send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
            <FiSend />
          </button>
        </div>
      </div>

      {showKeyModal && (
        <ApiKeyModal
          hasKey={hasKey}
          onClose={() => setShowKeyModal(false)}
          onSave={(key) => { setApiKey(key); setHasKey(true); setShowKeyModal(false); }}
          onRemove={() => { setApiKey(null); setHasKey(false); setShowKeyModal(false); }}
        />
      )}
    </div>
  );
};

const ApiKeyModal = ({ hasKey, onClose, onSave, onRemove }) => {
  const [key, setKey] = useState('');

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={e => e.stopPropagation()}>
        <h3>Claude API Key</h3>
        <p>Enter your Anthropic API key. It is stored locally in this browser only.</p>
        <input
          type="password"
          placeholder="sk-ant-..."
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && key.trim() && onSave(key.trim())}
        />
        <div className="ai-modal-actions">
          <button className="ai-modal-cancel" onClick={onClose}>Cancel</button>
          {hasKey && (
            <button className="ai-modal-remove" onClick={onRemove}>Remove Key</button>
          )}
          <button className="ai-modal-save" onClick={() => key.trim() && onSave(key.trim())}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;

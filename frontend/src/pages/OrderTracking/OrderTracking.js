import React, { useState, useEffect, useRef } from 'react';
import './OrderTracking.css';

const OrderTracking = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [tracking, setTracking] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  // Extract order number from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const num = params.get('order');
    if (num) {
      setOrderNumber(num);
      fetchTracking(num);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const getBaseURL = () => {
    if (window.SERVER_URL) return window.SERVER_URL;
    if (process.env.NODE_ENV === 'development') return '';
    return `http://${window.location.hostname}:5001`;
  };

  const fetchTracking = async (num) => {
    const orderNum = (num || orderNumber).trim().toUpperCase();
    if (!orderNum) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${getBaseURL()}/api/track/${orderNum}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Order not found');
      }
      const data = await res.json();
      setTracking(data);

      // Auto-poll every 15 seconds for active orders
      if (pollRef.current) clearInterval(pollRef.current);
      if (!['completed', 'cancelled', 'delivered'].includes(data.status)) {
        pollRef.current = setInterval(() => fetchTracking(orderNum), 15000);
      }
    } catch (err) {
      setError(err.message);
      setTracking(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusEmoji = (status) => {
    const map = { placed: '📝', confirmed: '✅', preparing: '👨‍🍳', ready: '🔔', served: '🍽️', out_for_delivery: '🛵', delivered: '📦', completed: '✨', cancelled: '❌' };
    return map[status] || '⏳';
  };

  return (
    <div className="tracking-page">
      <div className="tracking-container">
        <div className="tracking-brand">
          <h1>🍽️ Order Tracking</h1>
          <p>Track your order in real-time</p>
        </div>

        <div className="tracking-search">
          <input
            type="text"
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value.toUpperCase())}
            placeholder="Enter Order Number (e.g. ORD-001)"
            onKeyDown={e => e.key === 'Enter' && fetchTracking()}
          />
          <button onClick={() => fetchTracking()} disabled={loading || !orderNumber.trim()}>
            {loading ? 'Searching...' : 'Track'}
          </button>
        </div>

        {error && <div className="tracking-error">{error}</div>}

        {tracking && (
          <div className="tracking-result">
            <div className="tracking-order-header">
              <div>
                <h2>Order #{tracking.orderNumber}</h2>
                <span className="order-type-badge">{tracking.type?.replace('_', ' ')}</span>
              </div>
              <div className="tracking-status-big">
                {getStatusEmoji(tracking.status)} {tracking.status?.replace('_', ' ')}
              </div>
            </div>

            {/* Timeline */}
            <div className="tracking-timeline">
              {tracking.timeline?.map((step, idx) => (
                <div key={step.status} className={`timeline-step ${step.completed ? 'done' : ''} ${step.current ? 'current' : ''}`}>
                  <div className="timeline-dot">
                    {step.completed ? '✓' : idx + 1}
                  </div>
                  <div className="timeline-label">{step.label}</div>
                  {idx < tracking.timeline.length - 1 && <div className="timeline-line" />}
                </div>
              ))}
            </div>

            {/* Items */}
            <div className="tracking-items">
              <h3>Your Items</h3>
              {tracking.items?.map((item, idx) => (
                <div key={idx} className="tracking-item">
                  <span className="item-name">{item.name}</span>
                  <span className="item-qty">×{item.quantity}</span>
                  <span className={`item-status ${item.status}`}>{item.status}</span>
                </div>
              ))}
            </div>

            {/* Delivery info */}
            {tracking.delivery && (
              <div className="tracking-delivery">
                <h3>🚚 Delivery Status</h3>
                <p><strong>Status:</strong> {tracking.delivery.status?.replace('_', ' ')}</p>
                {tracking.delivery.assignedTo && <p><strong>Rider:</strong> {tracking.delivery.assignedTo}</p>}
                {tracking.delivery.estimatedTime && <p><strong>ETA:</strong> ~{tracking.delivery.estimatedTime} mins</p>}
              </div>
            )}

            {tracking.tableNumber && (
              <div className="tracking-table">
                🪑 Table #{tracking.tableNumber}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTracking;

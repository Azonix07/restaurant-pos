import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import './QROrder.css';

const CustomerOrder = () => {
  const { tableNumber } = useParams();
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderInfo, setOrderInfo] = useState(null);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await api.get('/qr/menu');
        setMenu(res.data.items || []);
        setCategories(res.data.categories || []);
      } catch (err) { console.error(err); }
    };
    fetchMenu();
  }, []);

  const addToCart = (item) => {
    const existing = cart.find(c => c.menuItemId === item._id);
    if (existing) {
      setCart(cart.map(c => c.menuItemId === item._id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { menuItemId: item._id, name: item.name, price: item.price, quantity: 1 }]);
    }
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => {
      if (c.menuItemId === id) {
        const newQty = c.quantity + delta;
        return newQty > 0 ? { ...c, quantity: newQty } : c;
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const getTotal = () => cart.reduce((s, c) => s + c.price * c.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    try {
      const res = await api.post('/qr/order', {
        tableNumber: parseInt(tableNumber, 10),
        items: cart,
        customerName: customerName || 'Guest',
      });
      setOrderPlaced(true);
      setOrderInfo(res.data.order);
      toast.success('Order placed!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    }
  };

  const filteredMenu = menu.filter(i => !activeCategory || i.category === activeCategory);

  if (orderPlaced) {
    return (
      <div className="customer-page">
        <div className="customer-success">
          <h1>✅ Order Placed!</h1>
          <p className="mb-16">Order: <strong>{orderInfo?.orderNumber}</strong></p>
          <p className="mb-16">Total: <strong>₹{orderInfo?.total?.toFixed(2)}</strong></p>
          <p className="text-secondary">Your order has been sent to the kitchen. Please wait at Table {tableNumber}.</p>
          <button className="btn btn-primary btn-lg mt-16" onClick={() => { setOrderPlaced(false); setCart([]); }}>
            Place Another Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-page">
      <div className="customer-header">
        <h1>🍽️ Menu</h1>
        <span className="table-badge">Table {tableNumber}</span>
      </div>

      <div className="input-group">
        <input className="input" placeholder="Your name (optional)" value={customerName} onChange={e => setCustomerName(e.target.value)} />
      </div>

      <div className="category-tabs mb-16">
        <button className={`cat-tab ${!activeCategory ? 'active' : ''}`} onClick={() => setActiveCategory('')}>All</button>
        {categories.map(c => (
          <button key={c} className={`cat-tab ${activeCategory === c ? 'active' : ''}`} onClick={() => setActiveCategory(c)}>{c}</button>
        ))}
      </div>

      <div className="customer-menu-list">
        {filteredMenu.map(item => (
          <div key={item._id} className="customer-menu-item">
            <div>
              <span className={`veg-dot ${item.isVeg ? 'veg' : 'non-veg'}`} />
              <strong>{item.name}</strong>
              {item.description && <p className="text-secondary" style={{ fontSize: '12px' }}>{item.description}</p>}
            </div>
            <div className="flex gap-8" style={{ alignItems: 'center' }}>
              <span>₹{item.price}</span>
              <button className="btn btn-primary btn-sm" onClick={() => addToCart(item)}>Add</button>
            </div>
          </div>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="customer-cart">
          <h3>Your Order ({cart.reduce((s, c) => s + c.quantity, 0)} items)</h3>
          {cart.map(item => (
            <div key={item.menuItemId} className="cart-item">
              <span>{item.name}</span>
              <div className="flex gap-8" style={{ alignItems: 'center' }}>
                <button className="qty-btn" onClick={() => updateQty(item.menuItemId, -1)}>-</button>
                <span>{item.quantity}</span>
                <button className="qty-btn" onClick={() => updateQty(item.menuItemId, 1)}>+</button>
                <span>₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            </div>
          ))}
          <div className="cart-total"><strong>Total: ₹{getTotal().toFixed(2)}</strong></div>
          <button className="btn btn-success btn-lg" style={{ width: '100%' }} onClick={placeOrder}>
            Place Order
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomerOrder;

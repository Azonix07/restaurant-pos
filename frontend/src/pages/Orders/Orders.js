import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { FiPlus, FiX, FiSearch } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Orders.css';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [orderType, setOrderType] = useState('dine_in');
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const endpoint = filterStatus === 'active' ? '/orders/active' : '/orders';
      const res = await api.get(endpoint);
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error(err);
    }
  }, [filterStatus]);

  const fetchMenu = async () => {
    try {
      const [menuRes, catRes, tableRes] = await Promise.all([
        api.get('/menu?available=true'),
        api.get('/menu/categories'),
        api.get('/tables'),
      ]);
      setMenuItems(menuRes.data.items || []);
      setCategories(catRes.data.categories || []);
      setTables(tableRes.data.tables || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchOrders(); fetchMenu(); }, [fetchOrders]);

  useSocket('order:new', () => fetchOrders());
  useSocket('order:statusChange', () => fetchOrders());
  useSocket('order:update', () => fetchOrders());

  const addToCart = (item) => {
    const existing = cart.find(c => c.menuItem === item._id);
    if (existing) {
      setCart(cart.map(c => c.menuItem === item._id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, {
        menuItem: item._id,
        name: item.name,
        price: item.price,
        quantity: 1,
        gstCategory: item.gstCategory,
        notes: '',
      }]);
    }
  };

  const updateCartQuantity = (menuItemId, delta) => {
    setCart(cart.map(c => {
      if (c.menuItem === menuItemId) {
        const newQty = c.quantity + delta;
        return newQty > 0 ? { ...c, quantity: newQty } : c;
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const removeFromCart = (menuItemId) => {
    setCart(cart.filter(c => c.menuItem !== menuItemId));
  };

  const getCartTotal = () => cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    try {
      const payload = {
        items: cart,
        type: orderType,
        tableId: selectedTable || undefined,
      };
      await api.post('/orders', payload);
      toast.success('Order placed successfully!');
      setCart([]);
      setShowNewOrder(false);
      setSelectedTable('');
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success(`Order ${status}`);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const filteredMenu = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !activeCategory || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const statusOptions = ['placed', 'confirmed', 'preparing', 'ready', 'served', 'completed'];

  return (
    <div className="orders-page">
      <div className="page-header">
        <h1>Orders</h1>
        <div className="flex gap-8">
          <select className="input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="active">Active Orders</option>
            <option value="all">All Orders</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowNewOrder(true)}>
            <FiPlus /> New Order
          </button>
        </div>
      </div>

      {/* Orders list */}
      <div className="orders-grid">
        {orders.length === 0 ? (
          <div className="card text-center" style={{ gridColumn: '1 / -1', padding: '60px 20px' }}>
            <p className="text-secondary">No orders found</p>
          </div>
        ) : orders.map(order => (
          <div key={order._id} className={`order-card card ${order.status}`} onClick={() => setSelectedOrder(order)}>
            <div className="flex-between mb-8">
              <strong>{order.orderNumber}</strong>
              <span className={`badge badge-${order.status}`}>{order.status}</span>
            </div>
            <div className="order-card-info">
              {order.tableNumber && <span>Table {order.tableNumber}</span>}
              <span>{order.type?.replace('_', ' ')}</span>
              <span>{order.items?.length} items</span>
            </div>
            <div className="flex-between mt-16">
              <strong>₹{order.total?.toFixed(2)}</strong>
              <span className="text-secondary" style={{ fontSize: '12px' }}>
                {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <div className="order-actions mt-16">
                {statusOptions.slice(statusOptions.indexOf(order.status) + 1, statusOptions.indexOf(order.status) + 2).map(s => (
                  <button key={s} className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); updateOrderStatus(order._id, s); }}>
                    Mark {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New Order Modal */}
      {showNewOrder && (
        <div className="modal-overlay" onClick={() => setShowNewOrder(false)}>
          <div className="new-order-modal" onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-16">
              <h2>New Order</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowNewOrder(false)}><FiX /></button>
            </div>

            <div className="new-order-layout">
              {/* Menu side */}
              <div className="menu-panel">
                <div className="flex gap-8 mb-16">
                  <select className="input" value={orderType} onChange={e => setOrderType(e.target.value)} style={{ width: 'auto' }}>
                    <option value="dine_in">Dine In</option>
                    <option value="takeaway">Takeaway</option>
                    <option value="delivery">Delivery</option>
                  </select>
                  {orderType === 'dine_in' && (
                    <select className="input" value={selectedTable} onChange={e => setSelectedTable(e.target.value)} style={{ width: 'auto' }}>
                      <option value="">Select Table</option>
                      {tables.filter(t => t.status === 'available').map(t => (
                        <option key={t._id} value={t._id}>Table {t.number} ({t.capacity}p)</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="search-box mb-16">
                  <FiSearch />
                  <input className="input" placeholder="Search menu..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>

                <div className="category-tabs mb-16">
                  <button className={`cat-tab ${!activeCategory ? 'active' : ''}`} onClick={() => setActiveCategory('')}>All</button>
                  {categories.map(c => (
                    <button key={c} className={`cat-tab ${activeCategory === c ? 'active' : ''}`} onClick={() => setActiveCategory(c)}>{c}</button>
                  ))}
                </div>

                <div className="menu-grid">
                  {filteredMenu.map(item => (
                    <button key={item._id} className="menu-item-btn" onClick={() => addToCart(item)}>
                      <span className={`veg-dot ${item.isVeg ? 'veg' : 'non-veg'}`} />
                      <span className="menu-item-name">{item.name}</span>
                      <span className="menu-item-price">₹{item.price}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cart side */}
              <div className="cart-panel">
                <h3 className="mb-16">Cart ({cart.length})</h3>
                {cart.length === 0 ? (
                  <p className="text-secondary text-center">No items added</p>
                ) : (
                  <>
                    <div className="cart-items">
                      {cart.map(item => (
                        <div key={item.menuItem} className="cart-item">
                          <div className="cart-item-info">
                            <span className="cart-item-name">{item.name}</span>
                            <span className="cart-item-price">₹{item.price * item.quantity}</span>
                          </div>
                          <div className="cart-item-actions">
                            <button className="qty-btn" onClick={() => updateCartQuantity(item.menuItem, -1)}>-</button>
                            <span>{item.quantity}</span>
                            <button className="qty-btn" onClick={() => updateCartQuantity(item.menuItem, 1)}>+</button>
                            <button className="remove-btn" onClick={() => removeFromCart(item.menuItem)}><FiX /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="cart-total">
                      <strong>Total: ₹{getCartTotal().toFixed(2)}</strong>
                    </div>
                    <button className="btn btn-success btn-lg" style={{ width: '100%' }} onClick={placeOrder}>
                      Place Order
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="flex-between mb-16">
              <h2>Order {selectedOrder.orderNumber}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedOrder(null)}><FiX /></button>
            </div>
            <div className="mb-16">
              <span className={`badge badge-${selectedOrder.status}`}>{selectedOrder.status}</span>
              {selectedOrder.tableNumber && <span className="badge" style={{ marginLeft: 8, background: 'var(--bg-input)' }}>Table {selectedOrder.tableNumber}</span>}
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Item</th><th>Qty</th><th>Price</th><th>Status</th></tr>
              </thead>
              <tbody>
                {selectedOrder.items?.map(item => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>₹{(item.price * item.quantity).toFixed(2)}</td>
                    <td><span className={`badge badge-${item.status}`}>{item.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-16" style={{ textAlign: 'right' }}>
              <p>Subtotal: ₹{selectedOrder.subtotal?.toFixed(2)}</p>
              <p>GST: ₹{selectedOrder.gstAmount?.toFixed(2)}</p>
              {selectedOrder.discount > 0 && <p>Discount: -₹{selectedOrder.discount?.toFixed(2)}</p>}
              <p><strong>Total: ₹{selectedOrder.total?.toFixed(2)}</strong></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;

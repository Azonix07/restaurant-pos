import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { FiPrinter, FiCheck, FiSearch, FiWifi } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Billing.css';

const Billing = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [splitDetails, setSplitDetails] = useState([]);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders/active');
      setOrders(res.data.orders || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchOrders(); }, []);
  useSocket('order:new', () => fetchOrders());
  useSocket('order:statusChange', () => fetchOrders());

  const processPayment = async () => {
    if (!selectedOrder) return;
    try {
      const payload = { paymentMethod, discount: parseFloat(discount) || 0 };
      if (paymentMethod === 'split') payload.splitDetails = splitDetails;
      await api.post(`/orders/${selectedOrder._id}/payment`, payload);
      toast.success('Payment processed!');
      setSelectedOrder(null);
      setDiscount(0);
      setPaymentMethod('cash');
      setSplitDetails([]);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    }
  };

  const printBill = async () => {
    if (!selectedOrder) return;
    try {
      const res = await api.get(`/bill-print/${selectedOrder._id}/html`);
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      printWindow.document.write(res.data.html);
    } catch {
      // Fallback to local generation
      const bill = selectedOrder;
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      printWindow.document.write(`
        <html><head><title>Bill</title>
        <style>
          @page { size: 80mm auto; margin: 2mm; }
          body { font-family: 'Courier New', monospace; padding: 10px; max-width: 350px; margin: 0 auto; font-size: 13px; }
          h2 { text-align: center; margin: 0 0 4px; }
          .center { text-align: center; }
          .right { text-align: right; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
          .dline { border-top: 2px solid #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          td, th { padding: 3px 0; vertical-align: top; }
          th { text-align: left; border-bottom: 1px solid #000; }
          .total-row td { font-weight: bold; font-size: 16px; }
        </style></head><body>
        <h2>Restaurant POS</h2>
        <p class="center">Bill: ${bill.billNumber || bill.orderNumber}<br/>
        Date: ${new Date(bill.createdAt).toLocaleString('en-IN')}<br/>
        ${bill.tableNumber ? `Table: ${bill.tableNumber}` : ''}</p>
        <div class="dline"></div>
        <table>
          <tr><th>Item</th><th class="right">Qty</th><th class="right">Amount</th></tr>
          ${bill.items?.filter(i => i.status !== 'cancelled').map(i => `<tr><td>${i.name}</td><td class="right">${i.quantity}</td><td class="right">₹${(i.price * i.quantity).toFixed(2)}</td></tr>`).join('')}
        </table>
        <div class="dline"></div>
        <table>
          <tr><td>Subtotal</td><td class="right">₹${bill.subtotal?.toFixed(2)}</td></tr>
          <tr><td>GST</td><td class="right">₹${bill.gstAmount?.toFixed(2)}</td></tr>
          ${bill.discount > 0 ? `<tr><td>Discount</td><td class="right">-₹${bill.discount?.toFixed(2)}</td></tr>` : ''}
          <tr style="font-weight:bold;font-size:16px"><td>TOTAL</td><td class="right">₹${bill.total?.toFixed(2)}</td></tr>
          <tr><td>Payment</td><td class="right">${(bill.paymentMethod || '').toUpperCase()}</td></tr>
        </table>
        <div class="line"></div>
        <p class="center" style="font-size:11px">CGST: ₹${(bill.gstAmount / 2)?.toFixed(2)} | SGST: ₹${(bill.gstAmount / 2)?.toFixed(2)}</p>
        <div class="line"></div>
        <p class="center">Thank you! Visit Again!</p>
        <script>window.print();</script>
        </body></html>
      `);
    }
  };

  const printThermal = async () => {
    if (!selectedOrder) return;
    try {
      await api.post(`/bill-print/${selectedOrder._id}/auto`);
      toast.success('Bill sent to thermal printer');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thermal print failed — check printer config');
    }
  };

  const filteredOrders = orders.filter(o =>
    o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(o.tableNumber || '').includes(searchTerm)
  );

  const calcTotal = () => {
    if (!selectedOrder) return 0;
    return selectedOrder.subtotal + selectedOrder.gstAmount - (parseFloat(discount) || 0);
  };

  return (
    <div className="billing-page">
      <div className="page-header">
        <h1>Billing</h1>
      </div>

      <div className="billing-layout">
        <div className="billing-orders-panel">
          <div className="search-box mb-16">
            <FiSearch />
            <input className="input" placeholder="Search by order # or table..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>

          <div className="billing-orders-list">
            {filteredOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').map(order => (
              <div
                key={order._id}
                className={`billing-order-item ${selectedOrder?._id === order._id ? 'selected' : ''}`}
                onClick={() => { setSelectedOrder(order); setDiscount(0); }}
              >
                <div className="flex-between">
                  <strong>{order.orderNumber}</strong>
                  <span className={`badge badge-${order.status}`}>{order.status}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {order.tableNumber ? `Table ${order.tableNumber}` : order.type} · {order.items?.length} items · ₹{order.total?.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="billing-detail-panel">
          {!selectedOrder ? (
            <div className="text-center" style={{ padding: '60px 20px', color: 'var(--text-secondary)' }}>
              Select an order to process billing
            </div>
          ) : (
            <>
              <div className="flex-between mb-16">
                <h2>{selectedOrder.orderNumber}</h2>
                <button className="btn btn-secondary btn-sm" onClick={printBill}><FiPrinter /> Print</button>
                <button className="btn btn-secondary btn-sm" onClick={printThermal} title="Send to thermal printer"><FiWifi /> Thermal</button>
              </div>

              <table className="data-table mb-16">
                <thead>
                  <tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map(item => (
                    <tr key={item._id}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>₹{item.price}</td>
                      <td>₹{(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bill-summary">
                <div className="bill-row"><span>Subtotal</span><span>₹{selectedOrder.subtotal?.toFixed(2)}</span></div>
                <div className="bill-row"><span>GST</span><span>₹{selectedOrder.gstAmount?.toFixed(2)}</span></div>
                <div className="bill-row">
                  <span>Discount</span>
                  <input type="number" className="input" style={{ width: 100, textAlign: 'right' }} value={discount} onChange={e => setDiscount(e.target.value)} min="0" />
                </div>
                <div className="bill-row bill-total">
                  <strong>TOTAL</strong><strong>₹{calcTotal().toFixed(2)}</strong>
                </div>
              </div>

              <div className="payment-methods mb-16">
                <h4 className="mb-8">Payment Method</h4>
                <div className="flex gap-8">
                  {['cash', 'card', 'upi', 'split'].map(m => (
                    <button
                      key={m}
                      className={`btn ${paymentMethod === m ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setPaymentMethod(m)}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn btn-success btn-lg" style={{ width: '100%' }} onClick={processPayment}>
                <FiCheck /> Process Payment — ₹{calcTotal().toFixed(2)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Billing;

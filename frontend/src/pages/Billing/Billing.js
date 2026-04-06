import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { FiPrinter, FiCheck, FiSearch, FiWifi, FiList, FiDownload } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Billing.css';

const downloadExport = async (url, filename) => {
  try {
    const res = await api.get(url, { responseType: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(res.data);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Downloaded ' + filename);
  } catch (err) { toast.error('Export failed'); }
};

const DENOMINATIONS = [
  { key: 'notes2000', label: '₹2000', value: 2000 },
  { key: 'notes500', label: '₹500', value: 500 },
  { key: 'notes200', label: '₹200', value: 200 },
  { key: 'notes100', label: '₹100', value: 100 },
  { key: 'notes50', label: '₹50', value: 50 },
  { key: 'notes20', label: '₹20', value: 20 },
  { key: 'notes10', label: '₹10', value: 10 },
  { key: 'coins', label: 'Coins', value: 1 },
];

const Billing = () => {
  const [orders, setOrders] = useState([]);
  const [completedBills, setCompletedBills] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [companyName, setCompanyName] = useState('');
  const [discount, setDiscount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [splitDetails, setSplitDetails] = useState([]);
  const [showBillHistory, setShowBillHistory] = useState(false);
  const [denomination, setDenomination] = useState({
    notes2000: 0, notes500: 0, notes200: 0, notes100: 0,
    notes50: 0, notes20: 0, notes10: 0, coins: 0,
  });

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders/active');
      setOrders(res.data.orders || []);
    } catch (err) { console.error(err); }
  };

  const fetchCompletedBills = async () => {
    try {
      const res = await api.get('/orders/completed');
      setCompletedBills(res.data.orders || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchOrders(); fetchCompletedBills(); }, []);
  useSocket('order:new', () => fetchOrders());
  useSocket('order:statusChange', () => { fetchOrders(); fetchCompletedBills(); });
  useSocket('order:paid', () => fetchCompletedBills());

  const totalReceived = DENOMINATIONS.reduce(
    (sum, d) => sum + (denomination[d.key] || 0) * d.value, 0
  );

  const calcTotal = () => {
    if (!selectedOrder) return 0;
    return selectedOrder.subtotal + selectedOrder.gstAmount - (parseFloat(discount) || 0);
  };

  const changeToReturn = totalReceived - calcTotal();

  const resetDenomination = () => {
    setDenomination({
      notes2000: 0, notes500: 0, notes200: 0, notes100: 0,
      notes50: 0, notes20: 0, notes10: 0, coins: 0,
    });
  };

  const processPayment = async () => {
    if (!selectedOrder) return;
    try {
      const payload = { paymentMethod, discount: parseFloat(discount) || 0 };
      if (paymentMethod === 'split') payload.splitDetails = splitDetails;
      if (paymentMethod === 'company') payload.companyName = companyName;
      if (paymentMethod === 'cash' && totalReceived > 0) {
        payload.denomination = {
          ...denomination,
          totalReceived,
          changeToReturn: Math.max(0, changeToReturn),
        };
      }
      await api.post(`/orders/${selectedOrder._id}/payment`, payload);
      toast.success('Payment processed!');
      setSelectedOrder(null);
      setDiscount(0);
      setPaymentMethod('cash');
      setCompanyName('');
      setSplitDetails([]);
      resetDenomination();
      fetchOrders();
      fetchCompletedBills();
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

  return (
    <div className="billing-page">
      <div className="page-header">
        <h1>Billing</h1>
        <div className="flex gap-8">
          <button
            className={`btn ${showBillHistory ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowBillHistory(!showBillHistory)}
          >
            <FiList /> {showBillHistory ? 'Active Orders' : 'Bill History'}
          </button>
          {showBillHistory && (
            <>
              <button className="btn btn-secondary" onClick={() => downloadExport(`/export/bills/pdf?date=${new Date().toISOString().split('T')[0]}`, 'bills-today.pdf')}><FiDownload /> PDF</button>
              <button className="btn btn-success" onClick={() => downloadExport(`/export/bills/excel?date=${new Date().toISOString().split('T')[0]}`, 'bills-today.xlsx')}><FiDownload /> Excel</button>
            </>
          )}
        </div>
      </div>

      {showBillHistory ? (
        /* ================== BILL HISTORY ================== */
        <div className="bill-history">
          <h3 className="mb-16">Today's Bills ({completedBills.length})</h3>
          {completedBills.length === 0 ? (
            <div className="card text-center" style={{ padding: '40px 20px' }}>
              <p className="text-secondary">No bills yet today</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Order #</th>
                  <th>Table</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {completedBills.map(bill => (
                  <tr key={bill._id}>
                    <td><strong>{bill.billNumber || '-'}</strong></td>
                    <td>{bill.orderNumber}</td>
                    <td>{bill.tableNumber ? `Table ${bill.tableNumber}` : bill.type?.replace('_', ' ')}</td>
                    <td>{bill.items?.length}</td>
                    <td><strong>₹{bill.total?.toFixed(2)}</strong></td>
                    <td><span className={`badge badge-${bill.paymentMethod}`}>{(bill.paymentMethod || '').toUpperCase()}</span></td>
                    <td>{new Date(bill.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4" style={{ textAlign: 'right' }}><strong>Total:</strong></td>
                  <td><strong>₹{completedBills.reduce((s, b) => s + (b.total || 0), 0).toFixed(2)}</strong></td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      ) : (
        /* ================== BILLING LAYOUT ================== */
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
                  onClick={() => { setSelectedOrder(order); setDiscount(0); resetDenomination(); }}
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
                  <div className="flex gap-8">
                    <button className="btn btn-secondary btn-sm" onClick={printBill}><FiPrinter /> Print</button>
                    <button className="btn btn-secondary btn-sm" onClick={printThermal} title="Send to thermal printer"><FiWifi /> Thermal</button>
                  </div>
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
                    {['cash', 'card', 'upi', 'company', 'split'].map(m => (
                      <button
                        key={m}
                        className={`btn ${paymentMethod === m ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setPaymentMethod(m); if (m !== 'cash') resetDenomination(); }}
                      >
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'company' && (
                  <div className="input-group mb-16">
                    <label>Company Name</label>
                    <input className="input" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Enter company name" required />
                  </div>
                )}

                {/* Currency Denomination Section (Cash only) */}
                {paymentMethod === 'cash' && (
                  <div className="denomination-section mb-16">
                    <h4 className="mb-8">Currency Received</h4>
                    <div className="denomination-grid">
                      {DENOMINATIONS.map(d => (
                        <div key={d.key} className="denomination-row">
                          <span className="denomination-label">{d.label}</span>
                          <span className="denomination-multiply">×</span>
                          <input
                            type="number"
                            className="input denomination-input"
                            min="0"
                            value={denomination[d.key] || ''}
                            onChange={e => setDenomination({ ...denomination, [d.key]: parseInt(e.target.value) || 0 })}
                            placeholder="0"
                          />
                          <span className="denomination-subtotal">
                            = ₹{((denomination[d.key] || 0) * d.value).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="denomination-summary">
                      <div className="bill-row">
                        <span>Total Received</span>
                        <strong className={totalReceived >= calcTotal() ? 'text-success' : 'text-danger'}>
                          ₹{totalReceived.toLocaleString('en-IN')}
                        </strong>
                      </div>
                      {totalReceived > 0 && (
                        <div className="bill-row">
                          <span>Balance to Return</span>
                          <strong className={changeToReturn >= 0 ? 'text-success' : 'text-danger'}>
                            ₹{Math.max(0, changeToReturn).toLocaleString('en-IN')}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button className="btn btn-success btn-lg" style={{ width: '100%' }} onClick={processPayment}>
                  <FiCheck /> Process Payment — ₹{calcTotal().toFixed(2)}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;

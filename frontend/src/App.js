import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/common/Layout';
import ProtectedRoute from './components/common/ProtectedRoute';

// Pages
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Orders from './pages/Orders/Orders';
import Tables from './pages/Orders/Tables';
import Kitchen from './pages/Kitchen/Kitchen';
import Billing from './pages/Billing/Billing';
import QRCodes from './pages/QROrder/QRCodes';
import CustomerOrder from './pages/QROrder/CustomerOrder';
import Reports from './pages/Reports/Reports';
import Accounting from './pages/Accounting/Accounting';
import ExternalOrders from './pages/ExternalOrders/ExternalOrders';
import Settings from './pages/Settings/Settings';
import Parties from './pages/Parties/Parties';
import Invoices from './pages/Invoices/Invoices';
import Inventory from './pages/Inventory/Inventory';
import GSTReports from './pages/GSTReports/GSTReports';
import RecycleBin from './pages/RecycleBin/RecycleBin';
import AuditTrail from './pages/AuditTrail/AuditTrail';
import FixedAssets from './pages/FixedAssets/FixedAssets';
import Companies from './pages/Companies/Companies';
import TallySync from './pages/TallySync/TallySync';
import Monitoring from './pages/Monitoring/Monitoring';
import KitchenKOT from './pages/KitchenKOT/KitchenKOT';
import Customers from './pages/Customers/Customers';
import StockManagement from './pages/StockManagement/StockManagement';
import Wastage from './pages/Wastage/Wastage';
import Devices from './pages/Devices/Devices';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/qr-order/:tableNumber" element={<CustomerOrder />} />

          {/* Protected routes inside Layout */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/tables" element={<Tables />} />
            <Route path="/kitchen" element={<Kitchen />} />
            <Route path="/billing" element={
              <ProtectedRoute roles={['admin', 'manager', 'cashier']}><Billing /></ProtectedRoute>
            } />
            <Route path="/qr-codes" element={
              <ProtectedRoute roles={['admin', 'manager']}><QRCodes /></ProtectedRoute>
            } />
            <Route path="/external-orders" element={
              <ProtectedRoute roles={['admin', 'manager']}><ExternalOrders /></ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute roles={['admin', 'manager']}><Reports /></ProtectedRoute>
            } />
            <Route path="/accounting" element={
              <ProtectedRoute roles={['admin', 'manager']}><Accounting /></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>
            } />
            <Route path="/parties" element={
              <ProtectedRoute roles={['admin', 'manager']}><Parties /></ProtectedRoute>
            } />
            <Route path="/invoices" element={
              <ProtectedRoute roles={['admin', 'manager', 'cashier']}><Invoices /></ProtectedRoute>
            } />
            <Route path="/inventory" element={
              <ProtectedRoute roles={['admin', 'manager']}><Inventory /></ProtectedRoute>
            } />
            <Route path="/gst-reports" element={
              <ProtectedRoute roles={['admin', 'manager']}><GSTReports /></ProtectedRoute>
            } />
            <Route path="/recycle-bin" element={
              <ProtectedRoute roles={['admin']}><RecycleBin /></ProtectedRoute>
            } />
            <Route path="/audit-trail" element={
              <ProtectedRoute roles={['admin']}><AuditTrail /></ProtectedRoute>
            } />
            <Route path="/fixed-assets" element={
              <ProtectedRoute roles={['admin', 'manager']}><FixedAssets /></ProtectedRoute>
            } />
            <Route path="/companies" element={
              <ProtectedRoute roles={['admin']}><Companies /></ProtectedRoute>
            } />
            <Route path="/tally" element={
              <ProtectedRoute roles={['admin']}><TallySync /></ProtectedRoute>
            } />
            <Route path="/monitoring" element={
              <ProtectedRoute roles={['admin', 'manager']}><Monitoring /></ProtectedRoute>
            } />
            <Route path="/kitchen-kot" element={<KitchenKOT />} />
            <Route path="/customers" element={
              <ProtectedRoute roles={['admin', 'manager', 'cashier']}><Customers /></ProtectedRoute>
            } />
            <Route path="/stock-management" element={
              <ProtectedRoute roles={['admin', 'manager']}><StockManagement /></ProtectedRoute>
            } />
            <Route path="/wastage" element={
              <ProtectedRoute roles={['admin', 'manager']}><Wastage /></ProtectedRoute>
            } />
            <Route path="/devices" element={
              <ProtectedRoute roles={['admin']}><Devices /></ProtectedRoute>
            } />
          </Route>
        </Routes>
      </Router>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="dark"
      />
    </AuthProvider>
  );
}

export default App;

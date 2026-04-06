import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
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
import Counter from './pages/Counter/Counter';
import ProductionPage from './pages/Production/Production';
import FraudDashboard from './pages/FraudDashboard/FraudDashboard';
import SalesHistory from './pages/SalesHistory/SalesHistory';
import CompanyCredit from './pages/CompanyCredit/CompanyCredit';
import Backup from './pages/Backup/Backup';
import BarcodeManager from './pages/BarcodeManager/BarcodeManager';
import StaffAnalysis from './pages/StaffAnalysis/StaffAnalysis';
import Refunds from './pages/Refunds/Refunds';
import HeldOrders from './pages/HeldOrders/HeldOrders';
import TokenQueue from './pages/TokenQueue/TokenQueue';
import Suppliers from './pages/Suppliers/Suppliers';
import SystemModes from './pages/SystemModes/SystemModes';
import AIAssistant from './pages/AIAssistant/AIAssistant';

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
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
            <Route path="/counter" element={
              <ProtectedRoute roles={['admin', 'manager', 'cashier']}><Counter /></ProtectedRoute>
            } />
            <Route path="/production" element={
              <ProtectedRoute roles={['admin', 'manager']}><ProductionPage /></ProtectedRoute>
            } />
            <Route path="/fraud-dashboard" element={
              <ProtectedRoute roles={['admin', 'manager']}><FraudDashboard /></ProtectedRoute>
            } />
            <Route path="/sales-history" element={
              <ProtectedRoute roles={['admin', 'manager']}><SalesHistory /></ProtectedRoute>
            } />
            <Route path="/company-credit" element={
              <ProtectedRoute roles={['admin', 'manager']}><CompanyCredit /></ProtectedRoute>
            } />
            <Route path="/backup" element={
              <ProtectedRoute roles={['admin']}><Backup /></ProtectedRoute>
            } />
            <Route path="/barcode-manager" element={
              <ProtectedRoute roles={['admin', 'manager']}><BarcodeManager /></ProtectedRoute>
            } />
            <Route path="/staff-analysis" element={
              <ProtectedRoute roles={['admin', 'manager']}><StaffAnalysis /></ProtectedRoute>
            } />
            <Route path="/refunds" element={
              <ProtectedRoute roles={['admin', 'manager', 'cashier']}><Refunds /></ProtectedRoute>
            } />
            <Route path="/held-orders" element={
              <ProtectedRoute roles={['admin', 'manager', 'cashier']}><HeldOrders /></ProtectedRoute>
            } />
            <Route path="/token-queue" element={
              <ProtectedRoute roles={['admin', 'manager', 'cashier']}><TokenQueue /></ProtectedRoute>
            } />
            <Route path="/suppliers" element={
              <ProtectedRoute roles={['admin', 'manager']}><Suppliers /></ProtectedRoute>
            } />
            <Route path="/system-modes" element={
              <ProtectedRoute roles={['admin', 'manager']}><SystemModes /></ProtectedRoute>
            } />
            <Route path="/ai-assistant" element={
              <ProtectedRoute roles={['admin', 'manager']}><AIAssistant /></ProtectedRoute>
            } />
          </Route>
        </Routes>
      </Router>
      </SettingsProvider>
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

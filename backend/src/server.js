const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const setupSockets = require('./sockets');

// Route imports
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const tableRoutes = require('./routes/tables');
const orderRoutes = require('./routes/orders');
const expenseRoutes = require('./routes/expenses');
const reportRoutes = require('./routes/reports');
const externalRoutes = require('./routes/external');
const systemRoutes = require('./routes/system');
const qrOrderRoutes = require('./routes/qrOrder');
const partyRoutes = require('./routes/parties');
const accountingRoutes = require('./routes/accounting');
const invoiceRoutes = require('./routes/invoices');
const inventoryRoutes = require('./routes/inventory');
const companyRoutes = require('./routes/companies');
const gstrRoutes = require('./routes/gstr');
const tallyRoutes = require('./routes/tally');
const recycleBinRoutes = require('./routes/recycleBin');
const auditRoutes = require('./routes/audit');
const fixedAssetRoutes = require('./routes/fixedAssets');
const deviceRoutes = require('./routes/devices');
const kotRoutes = require('./routes/kot');
const customerRoutes = require('./routes/customers');
const stockRoutes = require('./routes/stock');
const wastageRoutes = require('./routes/wastage');
const monitoringRoutes = require('./routes/monitoring');
const syncRoutes = require('./routes/sync');
const counterRoutes = require('./routes/counter');
const productionRoutes = require('./routes/production');
const billPrintRoutes = require('./routes/billPrint');
const fraudRoutes = require('./routes/fraud');
const exportRoutes = require('./routes/export');
const backupRoutes = require('./routes/backup');
const { serveImages, serveWastage } = require('./middleware/upload');

const app = express();
const server = http.createServer(app);

// Socket.io with CORS for LAN access
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Make io accessible from routes
app.set('io', io);
app.set('port', config.port);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/qr', qrOrderRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/gstr', gstrRoutes);
app.use('/api/tally', tallyRoutes);
app.use('/api/recycle-bin', recycleBinRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/fixed-assets', fixedAssetRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/kot', kotRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/wastage', wastageRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/counter', counterRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/bill-print', billPrintRoutes);
app.use('/api/fraud', fraudRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/backup', backupRoutes);

// Serve uploaded images with caching
app.use('/uploads/images', serveImages);
app.use('/uploads/wastage', serveWastage);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), mode: 'lan' });
});

// Serve frontend in production
// Support both dev layout (../../frontend/build) and packaged Electron layout (../frontend/build)
const frontendBuildPath = require('fs').existsSync(path.join(__dirname, '../../frontend/build'))
  ? path.join(__dirname, '../../frontend/build')
  : path.join(__dirname, '../frontend/build');
app.use(express.static(frontendBuildPath));
app.get('/qr-order/*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  }
});

// Error handler
app.use(errorHandler);

// Setup socket events
setupSockets(io);

// Start server
const startServer = async () => {
  await connectDB();

  // Start cloud sync service after a delay (non-blocking)
  setTimeout(() => {
    const { startSync } = require('./services/cloudSync');
    startSync().catch(err => console.error('[CloudSync] Init error:', err.message));
  }, 5000);

  server.listen(config.port, '0.0.0.0', () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let lanIP = 'localhost';

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          lanIP = iface.address;
          break;
        }
      }
    }

    console.log('='.repeat(50));
    console.log('Restaurant POS Server Running');
    console.log('='.repeat(50));
    console.log(`Local:   http://localhost:${config.port}`);
    console.log(`LAN:     http://${lanIP}:${config.port}`);
    console.log('='.repeat(50));
  });
};

startServer();

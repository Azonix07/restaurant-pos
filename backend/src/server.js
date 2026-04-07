const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const setupSockets = require('./sockets');
const logger = require('./utils/logger');

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
const refundRoutes = require('./routes/refunds');
const holdRoutes = require('./routes/hold');
const tokenRoutes = require('./routes/tokens');
const purchaseRoutes = require('./routes/purchase');
const settingsRoutes = require('./routes/settings');
const whatsappRoutes = require('./routes/whatsapp');
const deliveryRoutes = require('./routes/delivery');
const pinRoutes = require('./routes/pin');
const loadTestRoutes = require('./routes/loadTest');
const roleRoutes = require('./routes/roles');
const approvalRoutes = require('./routes/approvals');
const trackingRoutes = require('./routes/tracking');
const draftRoutes = require('./routes/drafts');
const systemHealthRoutes = require('./routes/systemHealth');
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
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — 200 requests per minute per IP (generous for POS LAN use)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down' },
});
app.use('/api/', apiLimiter);

// Auth endpoints get stricter rate limiting (20 per minute)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { message: 'Too many login attempts, please wait' },
});
app.use('/api/auth/login', authLimiter);

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
}

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
app.use('/api/refunds', refundRoutes);
app.use('/api/hold', holdRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/pin', pinRoutes);
app.use('/api/load-test', loadTestRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/system-health', systemHealthRoutes);

// Public routes (no auth)
app.use('/api/track', trackingRoutes);

// Serve uploaded images with caching
app.use('/uploads/images', serveImages);
app.use('/uploads/wastage', serveWastage);

// Health check
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: 'lan',
    uptime: process.uptime(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
  });
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
app.get('/track', (req, res) => {
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

// Setup draft auto-save sockets
const { setupDraftSockets } = require('./services/draftRecovery');
setupDraftSockets(io);

// Initialize background workers (event bus → job queue)
const { initWorkers } = require('./services/workers');
initWorkers(io);

// Start background fraud monitor
const { startFraudMonitor } = require('./services/fraudMonitor');
startFraudMonitor(io);

// Start auto-backup scheduler
const { startAutoBackup } = require('./services/autoBackup');
startAutoBackup();

// Rush mode auto-trigger check every 2 minutes
const { checkRushAutoTrigger } = require('./controllers/settingsController');
setInterval(() => checkRushAutoTrigger(io), 120000);

// Start server
const startServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    logger.error('Failed to start: Database connection failed after retries');
    logger.error(error.message);
    process.exit(1);
  }

  // Seed default roles
  try {
    const { seedDefaults } = require('./controllers/roleController');
    await seedDefaults();
    logger.info('Default roles seeded');
  } catch (err) {
    logger.warn('Role seeding skipped: ' + err.message);
  }

  // Start cloud sync service after a delay (non-blocking)
  setTimeout(() => {
    const { startSync } = require('./services/cloudSync');
    startSync().catch(err => logger.warn('[CloudSync] Init error: ' + err.message));
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
    console.log(`Mode:    ${process.env.NODE_ENV || 'development'}`);
    console.log('='.repeat(50));
  });
};

startServer();

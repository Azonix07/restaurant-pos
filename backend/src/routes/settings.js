const router = require('express').Router();
const ctrl = require('../controllers/settingsController');
const { auth, authorize } = require('../middleware/auth');

// Get current settings (all roles)
router.get('/', auth, ctrl.getSettings);

// Rush Mode
router.post('/rush-mode/toggle', auth, authorize('admin', 'manager'), ctrl.toggleRushMode);
router.put('/rush-mode/config', auth, authorize('admin'), ctrl.updateRushConfig);

// Test Mode (admin only)
router.post('/test-mode/toggle', auth, authorize('admin'), ctrl.toggleTestMode);
router.post('/test-mode/generate', auth, authorize('admin'), ctrl.generateTestData);
router.post('/test-mode/clear', auth, authorize('admin'), ctrl.clearTestData);

// UI Mode
router.put('/ui-mode', auth, authorize('admin', 'manager'), ctrl.updateUIMode);

// Smart alerts
router.get('/smart-alerts', auth, ctrl.getSmartAlerts);
router.get('/insights', auth, ctrl.getInsights);
router.put('/alert-config', auth, authorize('admin'), ctrl.updateAlertConfig);

module.exports = router;

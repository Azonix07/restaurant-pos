const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const loadTestController = require('../controllers/loadTestController');

router.use(auth);
router.use(authorize('admin'));

router.post('/rush-hour', loadTestController.simulateRushHour);
router.post('/network-failure', loadTestController.simulateNetworkFailure);
router.post('/clean-test-data', loadTestController.cleanTestData);
router.get('/performance', loadTestController.getPerformanceStats);

module.exports = router;

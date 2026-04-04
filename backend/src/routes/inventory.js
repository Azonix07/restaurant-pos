const router = require('express').Router();
const ctrl = require('../controllers/inventoryController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, ctrl.getInventory);
router.post('/bulk-update', auth, authorize('admin', 'manager'), ctrl.bulkUpdate);
router.post('/bulk-import', auth, authorize('admin'), ctrl.bulkImport);
router.put('/:id/pricing', auth, authorize('admin', 'manager'), ctrl.setPricing);

module.exports = router;

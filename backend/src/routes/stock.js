const router = require('express').Router();
const ctrl = require('../controllers/stockController');
const { auth, authorize, masterOnly } = require('../middleware/auth');

// Raw materials
router.get('/materials', auth, ctrl.getAllMaterials);
router.post('/materials', auth, authorize('admin', 'manager'), masterOnly, ctrl.createMaterial);
router.put('/materials/:id', auth, authorize('admin', 'manager'), masterOnly, ctrl.updateMaterial);

// Stock movements
router.get('/movements', auth, authorize('admin', 'manager'), ctrl.getMovements);
router.post('/stock-in', auth, authorize('admin', 'manager'), masterOnly, ctrl.stockIn);
router.post('/stock-out', auth, authorize('admin', 'manager'), masterOnly, ctrl.stockOut);
router.get('/alerts', auth, ctrl.getStockAlerts);

// Recipes / BOM
router.get('/recipes', auth, ctrl.getAllRecipes);
router.post('/recipes', auth, authorize('admin', 'manager'), masterOnly, ctrl.createRecipe);
router.put('/recipes/:id', auth, authorize('admin', 'manager'), masterOnly, ctrl.updateRecipe);
router.delete('/recipes/:id', auth, authorize('admin'), masterOnly, ctrl.deleteRecipe);

// Barcode lookup
router.get('/barcode/:barcode', auth, ctrl.findByBarcode);

// Expiry and dead stock reports
router.get('/expiring', auth, authorize('admin', 'manager'), ctrl.getExpiringItems);
router.get('/dead-stock', auth, authorize('admin', 'manager'), ctrl.getDeadStock);

module.exports = router;

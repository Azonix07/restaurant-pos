const router = require('express').Router();
const ctrl = require('../controllers/menuController');
const { auth, authorize, masterOnly } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

router.get('/', ctrl.getAll);
router.get('/categories', ctrl.getCategories);
router.post('/', auth, authorize('admin', 'manager'), masterOnly, ctrl.create);
router.put('/:id', auth, authorize('admin', 'manager'), masterOnly, ctrl.update);
router.delete('/:id', auth, authorize('admin', 'manager'), masterOnly, ctrl.remove);
router.patch('/:id/toggle', auth, authorize('admin', 'manager'), ctrl.toggleAvailability);
// Image upload - master only
router.post('/:id/image', auth, authorize('admin', 'manager'), masterOnly, uploadImage.single('image'), ctrl.uploadImage);
// Barcode lookup
router.get('/barcode/:barcode', auth, ctrl.findByBarcode);
// Barcode generation
router.post('/:id/barcode', auth, authorize('admin', 'manager'), ctrl.generateBarcode);
router.post('/barcode/bulk-generate', auth, authorize('admin', 'manager'), ctrl.bulkGenerateBarcodes);
router.post('/:id/barcode/print', auth, authorize('admin', 'manager'), ctrl.printBarcode);

module.exports = router;

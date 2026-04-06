const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const roleController = require('../controllers/roleController');

router.use(auth);
router.use(authorize('admin'));

router.get('/', roleController.getAll);
router.get('/permissions', roleController.getPermissions);
router.post('/', roleController.create);
router.put('/:id', roleController.update);
router.delete('/:id', roleController.remove);
router.post('/assign', roleController.assignToUser);

module.exports = router;

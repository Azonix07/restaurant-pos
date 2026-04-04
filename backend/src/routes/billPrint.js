const router = require('express').Router();
const ctrl = require('../controllers/billPrintController');
const { auth } = require('../middleware/auth');

router.post('/:id/thermal', auth, ctrl.printBill);
router.get('/:id/html', auth, ctrl.getHTMLBill);
router.post('/:id/auto', auth, ctrl.autoPrint);

module.exports = router;

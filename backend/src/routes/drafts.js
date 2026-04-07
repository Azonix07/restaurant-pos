const router = require('express').Router();
const { auth, authorize } = require('../middleware/auth');
const { recoverDrafts, getAllDrafts, saveDraft, deleteDraft } = require('../services/draftRecovery');

// Recover drafts for a specific device
router.get('/recover', auth, async (req, res, next) => {
  try {
    const deviceId = req.headers['x-device-id'] || req.query.deviceId;
    const drafts = await recoverDrafts(deviceId);
    res.json({ drafts, count: drafts.length });
  } catch (err) {
    next(err);
  }
});

// Get all active drafts (admin monitoring)
router.get('/', auth, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const drafts = await getAllDrafts();
    res.json({ drafts, count: drafts.length });
  } catch (err) {
    next(err);
  }
});

// Save a draft via HTTP (fallback when sockets unavailable)
router.post('/', auth, async (req, res, next) => {
  try {
    const deviceId = req.headers['x-device-id'] || req.body.deviceId;
    if (!deviceId) return res.status(400).json({ message: 'deviceId is required' });
    const draft = await saveDraft({
      ...req.body,
      deviceId,
      userId: req.user._id,
      userName: req.user.name,
    });
    res.json({ draft });
  } catch (err) {
    next(err);
  }
});

// Delete a draft (finalize)
router.delete('/:deviceId', auth, async (req, res, next) => {
  try {
    await deleteDraft(req.params.deviceId, req.query.tableId);
    res.json({ message: 'Draft deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

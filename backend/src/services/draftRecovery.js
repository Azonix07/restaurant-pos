/**
 * Draft Auto-Save & Crash Recovery Service
 * 
 * Stores in-progress order drafts to the database every few seconds.
 * On server restart, recovers any drafts that were not finalized.
 * 
 * Flow:
 *   1. Client sends draft via socket → stored in DB with TTL
 *   2. When order is finalized → draft is deleted
 *   3. On restart → GET /api/drafts/recover returns all unfinalized drafts
 * 
 * Also provides a manual fallback billing mode flag for when
 * the system is in a degraded state.
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { eventBus, EVENTS } = require('./eventBus');

// ─── Draft Schema (lightweight, same DB) ─────────────────────
const draftSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
  tableNumber: Number,
  type: { type: String, enum: ['dine_in', 'takeaway', 'delivery'], default: 'dine_in' },
  items: [{ type: mongoose.Schema.Types.Mixed }],
  customerName: String,
  customerPhone: String,
  notes: String,
  metadata: { type: mongoose.Schema.Types.Mixed }, // extra context
  version: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'order_drafts',
});

// Auto-expire drafts after 24 hours
draftSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

const Draft = mongoose.model('OrderDraft', draftSchema);

// ─── API Methods ─────────────────────────────────────────────

/**
 * Save or update a draft (upsert by deviceId + tableId)
 */
const saveDraft = async (data) => {
  const { deviceId, userId, userName, tableId, tableNumber, type, items, customerName, customerPhone, notes, metadata } = data;
  if (!deviceId) throw new Error('deviceId is required for drafts');

  const filter = { deviceId };
  if (tableId) filter.tableId = tableId;

  const update = {
    userId,
    userName,
    tableId,
    tableNumber,
    type,
    items,
    customerName,
    customerPhone,
    notes,
    metadata,
    updatedAt: new Date(),
    $inc: { version: 1 },
  };

  const draft = await Draft.findOneAndUpdate(filter, update, { upsert: true, new: true });
  eventBus.emitEvent(EVENTS.DRAFT_SAVED, { draftId: draft._id, deviceId });
  return draft;
};

/**
 * Delete draft when order is finalized
 */
const deleteDraft = async (deviceId, tableId) => {
  const filter = { deviceId };
  if (tableId) filter.tableId = tableId;
  await Draft.deleteMany(filter);
};

/**
 * Recover all active drafts (called on server restart or device reconnection)
 */
const recoverDrafts = async (deviceId) => {
  const filter = {};
  if (deviceId) filter.deviceId = deviceId;
  return Draft.find(filter).sort({ updatedAt: -1 }).lean();
};

/**
 * Get all drafts for admin monitoring
 */
const getAllDrafts = async () => {
  return Draft.find({}).sort({ updatedAt: -1 }).lean();
};

// ─── Socket Integration ──────────────────────────────────────

const setupDraftSockets = (io) => {
  io.on('connection', (socket) => {
    // Client sends draft every 3 seconds
    socket.on('draft:save', async (data) => {
      try {
        const draft = await saveDraft(data);
        socket.emit('draft:saved', { draftId: draft._id, version: draft.version });
      } catch (err) {
        socket.emit('draft:error', { message: err.message });
      }
    });

    // Client confirms order was placed — remove draft
    socket.on('draft:finalize', async (data) => {
      try {
        await deleteDraft(data.deviceId, data.tableId);
        socket.emit('draft:finalized');
      } catch (err) {
        logger.error(`[Draft] Finalize error: ${err.message}`);
      }
    });

    // Device requests recovery (after reconnect or restart)
    socket.on('draft:recover', async (data) => {
      try {
        const drafts = await recoverDrafts(data.deviceId);
        socket.emit('draft:recovered', { drafts });
        if (drafts.length > 0) {
          eventBus.emitEvent(EVENTS.CRASH_RECOVERED, { deviceId: data.deviceId, draftCount: drafts.length });
          logger.info(`[Draft] Recovered ${drafts.length} draft(s) for device ${data.deviceId}`);
        }
      } catch (err) {
        socket.emit('draft:error', { message: err.message });
      }
    });
  });
};

module.exports = {
  Draft,
  saveDraft,
  deleteDraft,
  recoverDrafts,
  getAllDrafts,
  setupDraftSockets,
};

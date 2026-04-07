/**
 * Event Bus — Internal pub/sub system for the POS
 * 
 * Core functions emit events here AFTER completing their primary work.
 * Background workers subscribe and process asynchronously.
 * The event bus NEVER blocks the caller.
 * 
 * Architecture:
 *   core controller → emit(EVENT) → return response immediately
 *   background workers → on(EVENT) → process async (fraud, sync, reports, etc.)
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // allow many background subscribers
    this._stats = {
      emitted: 0,
      processed: 0,
      errors: 0,
      byEvent: {},
    };
  }

  /**
   * Emit an event with payload. Non-blocking — errors in listeners
   * are caught and logged, never propagated to the caller.
   */
  emitEvent(event, payload = {}) {
    const enriched = {
      ...payload,
      _event: event,
      _timestamp: Date.now(),
      _id: `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    this._stats.emitted++;
    this._stats.byEvent[event] = (this._stats.byEvent[event] || 0) + 1;

    // Emit asynchronously so the caller is never blocked
    setImmediate(() => {
      try {
        this.emit(event, enriched);
      } catch (err) {
        this._stats.errors++;
        logger.error(`[EventBus] Error emitting ${event}: ${err.message}`);
      }
    });

    return enriched._id;
  }

  /**
   * Subscribe a handler that runs asynchronously.
   * Errors are caught and logged, never crash the process.
   */
  subscribe(event, handler, label = 'anonymous') {
    this.on(event, async (payload) => {
      try {
        await handler(payload);
        this._stats.processed++;
      } catch (err) {
        this._stats.errors++;
        logger.error(`[EventBus] Handler "${label}" failed on ${event}: ${err.message}`);
      }
    });
    logger.info(`[EventBus] "${label}" subscribed to ${event}`);
  }

  /**
   * Get event bus statistics
   */
  getStats() {
    return { ...this._stats };
  }
}

// Singleton
const bus = new EventBus();

// ─── Event Names ─────────────────────────────────────────────
const EVENTS = {
  // Order lifecycle
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_STATUS_CHANGED: 'order:statusChanged',
  ORDER_ITEMS_ADDED: 'order:itemsAdded',
  ORDER_EDITED: 'order:edited',
  ORDER_CANCELLED: 'order:cancelled',

  // Payment
  PAYMENT_PROCESSED: 'payment:processed',
  REFUND_PROCESSED: 'refund:processed',

  // KOT
  KOT_GENERATED: 'kot:generated',
  KOT_BUMPED: 'kot:bumped',

  // Billing
  BILL_DELETED: 'bill:deleted',
  BILL_EDITED: 'bill:edited',

  // Inventory
  STOCK_DEDUCTED: 'stock:deducted',
  STOCK_LOW: 'stock:low',
  STOCK_IN: 'stock:in',
  WASTAGE_LOGGED: 'wastage:logged',

  // User & Auth
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',
  APPROVAL_REQUESTED: 'approval:requested',
  APPROVAL_RESOLVED: 'approval:resolved',

  // System
  SYSTEM_HEALTH_CHECK: 'system:healthCheck',
  DRAFT_SAVED: 'draft:saved',
  CRASH_RECOVERED: 'crash:recovered',

  // Sync
  SYNC_PUSHED: 'sync:pushed',
  SYNC_CONFLICT: 'sync:conflict',
};

module.exports = { eventBus: bus, EVENTS };

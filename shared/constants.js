// Shared constants between frontend and backend

const ORDER_STATUS = {
  PLACED: 'placed',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  UPI: 'upi',
  SPLIT: 'split',
};

const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  WAITER: 'waiter',
};

const TABLE_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  CLEANING: 'cleaning',
};

const SOCKET_EVENTS = {
  ORDER_NEW: 'order:new',
  ORDER_UPDATE: 'order:update',
  ORDER_STATUS_CHANGE: 'order:statusChange',
  ORDER_ITEM_STATUS: 'order:itemStatus',
  TABLE_UPDATE: 'table:update',
  KITCHEN_UPDATE: 'kitchen:update',
  NOTIFICATION: 'notification',
  EXTERNAL_ORDER: 'external:order',
  // Device & heartbeat events
  DEVICE_HEARTBEAT: 'device:heartbeat',
  DEVICE_HEARTBEAT_ACK: 'device:heartbeat:ack',
  DEVICE_DISCONNECTED: 'device:disconnected',
  DEVICE_RECONNECTED: 'device:reconnected',
  DEVICE_LOCKED: 'device:locked',
  DEVICE_UNLOCKED: 'device:unlocked',
  // KOT events
  KOT_NEW: 'kot:new',
  KOT_UPDATE: 'kot:update',
  KOT_PRINT: 'kot:print',
  // Alert events
  ALERT_NEW: 'alert:new',
  ALERT_DISMISS: 'alert:dismiss',
  // Sync events
  SYNC_REQUEST: 'sync:request',
  SYNC_COMPLETE: 'sync:complete',
  // Menu events
  MENU_UPDATE: 'menu:update',
  MENU_DELETE: 'menu:delete',
};

const GST_RATES = {
  FOOD_NON_AC: 5,
  FOOD_AC: 5,
  BEVERAGE: 18,
  ALCOHOL: 28,
  DEFAULT: 5,
};

const EXTERNAL_PLATFORMS = {
  SWIGGY: 'swiggy',
  ZOMATO: 'zomato',
};

const DEVICE_TYPES = {
  MASTER: 'master',
  CASHIER: 'cashier_terminal',
  WAITER: 'waiter_app',
  KITCHEN: 'kitchen_display',
  BAR: 'bar_display',
};

const DEVICE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  LOCKED: 'locked',
};

const KITCHEN_SECTIONS = {
  KITCHEN: 'kitchen',
  BAKERY: 'bakery',
  BAR: 'bar',
  DESSERTS: 'desserts',
};

const KOT_STATUS = {
  PENDING: 'pending',
  ACKNOWLEDGED: 'acknowledged',
  PREPARING: 'preparing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const STOCK_MOVEMENT = {
  IN: 'in',
  OUT: 'out',
  WASTAGE: 'wastage',
  PRODUCTION: 'production',
  ADJUSTMENT: 'adjustment',
  SALE: 'sale',
};

const ALERT_TYPES = {
  DEVICE_DISCONNECT: 'device_disconnect',
  LOW_STOCK: 'low_stock',
  HIGH_WASTAGE: 'high_wastage',
  BILL_MISMATCH: 'bill_mismatch',
  NO_SALES_ACTIVITY: 'no_sales_activity',
  FRAUD_ATTEMPT: 'fraud_attempt',
};

module.exports = {
  ORDER_STATUS,
  PAYMENT_METHODS,
  USER_ROLES,
  TABLE_STATUS,
  SOCKET_EVENTS,
  GST_RATES,
  EXTERNAL_PLATFORMS,
  DEVICE_TYPES,
  DEVICE_STATUS,
  KITCHEN_SECTIONS,
  KOT_STATUS,
  STOCK_MOVEMENT,
  ALERT_TYPES,
};

const { SOCKET_EVENTS } = require('../../../shared/constants');
const Device = require('../models/Device');
const AlertLog = require('../models/AlertLog');
const KOT = require('../models/KOT');

// Track connected devices: socketId -> { deviceId, lastHeartbeat }
const connectedDevices = new Map();

// Heartbeat check interval (runs on master)
let heartbeatCheckInterval = null;
let kitchenDelayCheckInterval = null;

const setupSockets = (io) => {
  // Start heartbeat monitor - check every 10 seconds
  if (heartbeatCheckInterval) clearInterval(heartbeatCheckInterval);
  if (kitchenDelayCheckInterval) clearInterval(kitchenDelayCheckInterval);

  // Kitchen delay monitor — check every 60 seconds for delayed KOTs
  kitchenDelayCheckInterval = setInterval(async () => {
    try {
      const DELAY_THRESHOLD_MINS = 15;
      const cutoff = new Date(Date.now() - DELAY_THRESHOLD_MINS * 60 * 1000);

      const delayedKots = await KOT.find({
        status: { $in: ['pending', 'preparing'] },
        createdAt: { $lt: cutoff },
      }).lean();

      if (delayedKots.length > 0) {
        io.to('kitchen').emit('kitchen:delayed', {
          count: delayedKots.length,
          kots: delayedKots.map(k => ({
            kotNumber: k.kotNumber,
            orderNumber: k.orderNumber,
            section: k.section,
            minutesElapsed: Math.floor((Date.now() - new Date(k.createdAt).getTime()) / 60000),
          })),
        });
        io.emit(SOCKET_EVENTS.SOUND_ALERT, { type: 'kitchen_delay', count: delayedKots.length });
      }
    } catch (err) {
      console.error('[KITCHEN DELAY] Check error:', err.message);
    }
  }, 60000);

  heartbeatCheckInterval = setInterval(async () => {
    const now = Date.now();
    const staleThreshold = 15000; // 15 seconds

    for (const [socketId, info] of connectedDevices.entries()) {
      if (now - info.lastHeartbeat > staleThreshold) {
        // Device is stale
        const device = await Device.findOne({ deviceId: info.deviceId });
        if (device && device.status === 'online') {
          device.status = 'offline';
          await device.save();

          const alert = await AlertLog.create({
            type: 'device_disconnect',
            severity: 'warning',
            title: `Device disconnected: ${device.name}`,
            message: `${device.name} (${device.type}) lost heartbeat. Last seen: ${new Date(info.lastHeartbeat).toLocaleTimeString()}`,
            device: device._id,
          });

          io.emit(SOCKET_EVENTS.DEVICE_DISCONNECTED, {
            deviceId: info.deviceId,
            deviceName: device.name,
            type: device.type,
          });
          io.emit(SOCKET_EVENTS.ALERT_NEW, alert);

          console.log(`[HEARTBEAT] Device offline: ${device.name} (${info.deviceId})`);
        }
        connectedDevices.delete(socketId);
      }
    }
  }, 10000);

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // ---- DEVICE REGISTRATION & HEARTBEAT ----

    socket.on('device:register', async (data) => {
      try {
        const { deviceId, type } = data;
        if (!deviceId) return;

        const device = await Device.findOne({ deviceId });
        if (device) {
          device.socketId = socket.id;
          device.status = 'online';
          device.lastHeartbeat = new Date();
          device.ipAddress = socket.handshake.address;
          await device.save();

          connectedDevices.set(socket.id, { deviceId, lastHeartbeat: Date.now() });

          // If device was previously offline, notify reconnection
          io.emit(SOCKET_EVENTS.DEVICE_RECONNECTED, {
            deviceId,
            deviceName: device.name,
            type: device.type,
          });

          // Join section room if kitchen display
          if (device.kitchenSection) {
            socket.join(device.kitchenSection);
          }
          // Join type room
          socket.join(device.type);

          socket.emit('device:registered', { approved: device.isApproved, locked: device.isLocked });
        }
      } catch (err) {
        console.error('Device register error:', err.message);
      }
    });

    socket.on(SOCKET_EVENTS.DEVICE_HEARTBEAT, async (data) => {
      try {
        const { deviceId } = data;
        if (!deviceId) return;

        // Update in-memory tracker
        const existing = connectedDevices.get(socket.id);
        if (existing) {
          existing.lastHeartbeat = Date.now();
        } else {
          connectedDevices.set(socket.id, { deviceId, lastHeartbeat: Date.now() });
        }

        // Update DB (throttled — only update if >5s since last DB write)
        const device = await Device.findOne({ deviceId });
        if (device) {
          const timeSinceUpdate = device.lastHeartbeat ? Date.now() - device.lastHeartbeat.getTime() : Infinity;
          if (timeSinceUpdate > 5000) {
            device.lastHeartbeat = new Date();
            device.status = 'online';
            device.socketId = socket.id;
            await device.save();
          }
        }

        // Acknowledge heartbeat (client can use this to detect connection health)
        socket.emit(SOCKET_EVENTS.DEVICE_HEARTBEAT_ACK, { timestamp: Date.now() });
      } catch (err) {
        console.error('Heartbeat error:', err.message);
      }
    });

    // ---- SYNC HANDLING ----

    socket.on(SOCKET_EVENTS.SYNC_REQUEST, async (data) => {
      // Client requests sync after reconnection — send recent changes
      const { deviceId, lastSyncAt } = data;
      try {
        const device = await Device.findOne({ deviceId });
        if (!device || !device.isApproved) {
          socket.emit(SOCKET_EVENTS.SYNC_COMPLETE, { error: 'Device not approved' });
          return;
        }

        const mongoose = require('mongoose');
        const db = mongoose.connection.db;
        const sinceDate = lastSyncAt ? new Date(lastSyncAt) : new Date(Date.now() - 3600000); // default: last 1hr

        // Fetch recent changes for critical collections
        const syncData = {};
        const collections = ['orders', 'menuitems', 'tables'];
        for (const col of collections) {
          try {
            syncData[col] = await db.collection(col)
              .find({ updatedAt: { $gt: sinceDate } })
              .sort({ updatedAt: -1 })
              .limit(200)
              .toArray();
          } catch { syncData[col] = []; }
        }

        // Mark sync timestamp
        device.lastSyncAt = new Date();
        await device.save();

        socket.emit(SOCKET_EVENTS.SYNC_COMPLETE, {
          success: true,
          syncedAt: device.lastSyncAt,
          data: syncData,
        });
      } catch (err) {
        socket.emit(SOCKET_EVENTS.SYNC_COMPLETE, { error: err.message });
      }
    });

    // ---- ROLE-BASED ROOMS ----

    socket.on('join:role', (role) => {
      socket.join(role);
      console.log(`${socket.id} joined room: ${role}`);
    });

    socket.on('join:kitchen', () => {
      socket.join('kitchen');
      console.log(`${socket.id} joined kitchen display`);
    });

    socket.on('join:billing', () => {
      socket.join('billing');
      console.log(`${socket.id} joined billing`);
    });

    // Join specific kitchen section
    socket.on('join:section', (section) => {
      socket.join(section);
      console.log(`${socket.id} joined section: ${section}`);
    });

    // ---- ORDER EVENTS ----

    socket.on(SOCKET_EVENTS.ORDER_NEW, (data) => {
      socket.broadcast.emit(SOCKET_EVENTS.ORDER_NEW, data);
    });

    socket.on(SOCKET_EVENTS.ORDER_UPDATE, (data) => {
      socket.broadcast.emit(SOCKET_EVENTS.ORDER_UPDATE, data);
    });

    socket.on(SOCKET_EVENTS.ORDER_STATUS_CHANGE, (data) => {
      socket.broadcast.emit(SOCKET_EVENTS.ORDER_STATUS_CHANGE, data);
    });

    socket.on(SOCKET_EVENTS.ORDER_ITEM_STATUS, (data) => {
      socket.broadcast.emit(SOCKET_EVENTS.ORDER_ITEM_STATUS, data);
    });

    socket.on(SOCKET_EVENTS.TABLE_UPDATE, (data) => {
      socket.broadcast.emit(SOCKET_EVENTS.TABLE_UPDATE, data);
    });

    socket.on(SOCKET_EVENTS.NOTIFICATION, (data) => {
      io.emit(SOCKET_EVENTS.NOTIFICATION, data);
    });

    // ---- KOT EVENTS ----

    socket.on(SOCKET_EVENTS.KOT_NEW, (data) => {
      socket.broadcast.emit(SOCKET_EVENTS.KOT_NEW, data);
      // Also emit to specific section room
      if (data.section) {
        socket.to(data.section).emit(SOCKET_EVENTS.KOT_NEW, data);
      }
      // Sound alert for kitchen displays
      io.to('kitchen').emit(SOCKET_EVENTS.SOUND_NEW_KOT, {
        kotNumber: data.kotNumber,
        section: data.section,
        itemCount: data.items?.length || 0,
      });
    });

    socket.on(SOCKET_EVENTS.KOT_UPDATE, (data) => {
      socket.broadcast.emit(SOCKET_EVENTS.KOT_UPDATE, data);
      // Sound alert if all items ready
      if (data.status === 'ready' || data.allReady) {
        io.emit(SOCKET_EVENTS.SOUND_ORDER_READY, {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          tableNumber: data.tableNumber,
        });
      }
    });

    // ---- DISCONNECT ----

    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);

      const deviceInfo = connectedDevices.get(socket.id);
      if (deviceInfo) {
        try {
          const device = await Device.findOne({ deviceId: deviceInfo.deviceId });
          if (device) {
            device.status = 'offline';
            await device.save();

            io.emit(SOCKET_EVENTS.DEVICE_DISCONNECTED, {
              deviceId: deviceInfo.deviceId,
              deviceName: device.name,
              type: device.type,
            });
          }
        } catch (err) {
          console.error('Disconnect cleanup error:', err.message);
        }
        connectedDevices.delete(socket.id);
      }
    });
  });
};

module.exports = setupSockets;

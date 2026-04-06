import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'api_service.dart';
import 'offline_storage.dart';

class SyncService extends ChangeNotifier {
  static SyncService? _instance;
  static SyncService get instance {
    _instance ??= SyncService._();
    return _instance!;
  }

  SyncService._();

  bool _isOnline = true;
  bool _isSyncing = false;
  int _pendingCount = 0;
  String? _lastSyncError;
  StreamSubscription? _connectivitySub;

  bool get isOnline => _isOnline;
  bool get isSyncing => _isSyncing;
  int get pendingCount => _pendingCount;
  String? get lastSyncError => _lastSyncError;

  /// Start monitoring network changes
  Future<void> init() async {
    // Check initial state
    await _checkConnectivity();
    await _updatePendingCount();

    // Listen for connectivity changes
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final wasOffline = !_isOnline;
      _isOnline = results.any((r) => r != ConnectivityResult.none);
      notifyListeners();

      // If we just came back online, sync everything
      if (_isOnline && wasOffline) {
        syncAll();
      }
    });
  }

  Future<void> _checkConnectivity() async {
    try {
      final results = await Connectivity().checkConnectivity();
      _isOnline = results.any((r) => r != ConnectivityResult.none);
    } catch (_) {
      _isOnline = false;
    }
    notifyListeners();
  }

  Future<void> _updatePendingCount() async {
    _pendingCount = await OfflineStorage.pendingCount;
    notifyListeners();
  }

  /// Verify actual server reachability (not just WiFi connected)
  Future<bool> _canReachServer() async {
    try {
      await ApiService.get('/menu').timeout(const Duration(seconds: 5));
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Flush all pending queues to the server
  Future<void> syncAll() async {
    if (_isSyncing || !_isOnline) return;

    // First verify we can actually reach the server
    final reachable = await _canReachServer();
    if (!reachable) {
      _isOnline = false;
      notifyListeners();
      return;
    }

    _isOnline = true;
    _isSyncing = true;
    _lastSyncError = null;
    notifyListeners();

    try {
      await _syncPendingOrders();
      await _syncPendingItemAdditions();
      await _syncPendingStatusUpdates();
    } catch (e) {
      _lastSyncError = e.toString();
    }

    _isSyncing = false;
    await _updatePendingCount();
    notifyListeners();
  }

  /// Sync queued new orders
  Future<void> _syncPendingOrders() async {
    final pending = await OfflineStorage.getPendingOrders();
    for (var i = 0; i < pending.length; i++) {
      try {
        await ApiService.post('/orders', pending[i]);
        await OfflineStorage.removePendingOrder(0); // always remove first (shifts)
      } catch (e) {
        _lastSyncError = 'Order sync failed: $e';
        break; // Stop on first failure to preserve order
      }
    }
  }

  /// Sync queued item additions
  Future<void> _syncPendingItemAdditions() async {
    final pending = await OfflineStorage.getPendingItemAdditions();
    for (var i = 0; i < pending.length; i++) {
      try {
        final orderId = pending[i]['orderId'] as String;
        final items = pending[i]['items'];
        await ApiService.post('/orders/$orderId/items', {'items': items});
        await OfflineStorage.removePendingItemAddition(0);
      } catch (e) {
        _lastSyncError = 'Item addition sync failed: $e';
        break;
      }
    }
  }

  /// Sync queued status updates
  Future<void> _syncPendingStatusUpdates() async {
    final pending = await OfflineStorage.getPendingStatusUpdates();
    for (var i = 0; i < pending.length; i++) {
      try {
        final orderId = pending[i]['orderId'] as String;
        final status = pending[i]['status'] as String;
        await ApiService.patch('/orders/$orderId/status', {'status': status});
        await OfflineStorage.removePendingStatusUpdate(0);
      } catch (e) {
        _lastSyncError = 'Status update sync failed: $e';
        break;
      }
    }
  }

  @override
  void dispose() {
    _connectivitySub?.cancel();
    super.dispose();
  }
}

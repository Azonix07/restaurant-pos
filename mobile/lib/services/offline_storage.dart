import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class OfflineStorage {
  static const _menuKey = 'cached_menu';
  static const _tablesKey = 'cached_tables';
  static const _pendingOrdersKey = 'pending_orders';
  static const _pendingStatusKey = 'pending_status_updates';
  static const _pendingItemsKey = 'pending_item_additions';
  static const _activeOrdersKey = 'cached_active_orders';
  static const _credentialsKey = 'cached_credentials';

  // ── Menu cache ──
  static Future<void> cacheMenu(List<dynamic> items) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_menuKey, jsonEncode(items));
  }

  static Future<List<dynamic>> getCachedMenu() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_menuKey);
    if (data == null) return [];
    return jsonDecode(data) as List<dynamic>;
  }

  // ── Tables cache ──
  static Future<void> cacheTables(List<dynamic> tables) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tablesKey, jsonEncode(tables));
  }

  static Future<List<dynamic>> getCachedTables() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_tablesKey);
    if (data == null) return [];
    return jsonDecode(data) as List<dynamic>;
  }

  // ── Active orders cache ──
  static Future<void> cacheActiveOrders(List<dynamic> orders) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_activeOrdersKey, jsonEncode(orders));
  }

  static Future<List<dynamic>> getCachedActiveOrders() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_activeOrdersKey);
    if (data == null) return [];
    return jsonDecode(data) as List<dynamic>;
  }

  // ── Pending new orders queue ──
  static Future<void> queueOrder(Map<String, dynamic> order) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_pendingOrdersKey) ?? [];
    queue.add(jsonEncode(order));
    await prefs.setStringList(_pendingOrdersKey, queue);
  }

  static Future<List<Map<String, dynamic>>> getPendingOrders() async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_pendingOrdersKey) ?? [];
    return queue.map((s) => Map<String, dynamic>.from(jsonDecode(s))).toList();
  }

  static Future<void> removePendingOrder(int index) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_pendingOrdersKey) ?? [];
    if (index < queue.length) {
      queue.removeAt(index);
      await prefs.setStringList(_pendingOrdersKey, queue);
    }
  }

  static Future<void> clearPendingOrders() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_pendingOrdersKey);
  }

  // ── Pending status updates queue ──
  static Future<void> queueStatusUpdate(String orderId, String status) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_pendingStatusKey) ?? [];
    queue.add(jsonEncode({'orderId': orderId, 'status': status}));
    await prefs.setStringList(_pendingStatusKey, queue);
  }

  static Future<List<Map<String, dynamic>>> getPendingStatusUpdates() async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_pendingStatusKey) ?? [];
    return queue.map((s) => Map<String, dynamic>.from(jsonDecode(s))).toList();
  }

  static Future<void> removePendingStatusUpdate(int index) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_pendingStatusKey) ?? [];
    if (index < queue.length) {
      queue.removeAt(index);
      await prefs.setStringList(_pendingStatusKey, queue);
    }
  }

  // ── Pending item additions queue ──
  static Future<void> queueItemAddition(String orderId, List<Map<String, dynamic>> items) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_pendingItemsKey) ?? [];
    queue.add(jsonEncode({'orderId': orderId, 'items': items}));
    await prefs.setStringList(_pendingItemsKey, queue);
  }

  static Future<List<Map<String, dynamic>>> getPendingItemAdditions() async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_pendingItemsKey) ?? [];
    return queue.map((s) => Map<String, dynamic>.from(jsonDecode(s))).toList();
  }

  static Future<void> removePendingItemAddition(int index) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_pendingItemsKey) ?? [];
    if (index < queue.length) {
      queue.removeAt(index);
      await prefs.setStringList(_pendingItemsKey, queue);
    }
  }

  // ── Credential cache for offline login ──
  static Future<void> cacheCredentials(String email, String password, String token, Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    // Store a hash of the password for offline verification, never the raw password
    final credHash = _simpleHash('$email:$password');
    await prefs.setString(_credentialsKey, jsonEncode({
      'email': email,
      'hash': credHash,
      'token': token,
      'user': user,
    }));
  }

  static Future<Map<String, dynamic>?> getCachedCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_credentialsKey);
    if (data == null) return null;
    return Map<String, dynamic>.from(jsonDecode(data));
  }

  static bool verifyOfflineCredentials(Map<String, dynamic> cached, String email, String password) {
    final hash = _simpleHash('$email:$password');
    return cached['email'] == email && cached['hash'] == hash;
  }

  static Future<void> clearCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_credentialsKey);
  }

  // Simple hash for offline credential verification
  // This is NOT for server-side security — just to avoid storing plaintext on device
  static String _simpleHash(String input) {
    var hash = 0x811c9dc5;
    for (var i = 0; i < input.length; i++) {
      hash ^= input.codeUnitAt(i);
      hash = (hash * 0x01000193) & 0xFFFFFFFF;
    }
    return hash.toRadixString(16);
  }

  // ── Pending queue counts ──
  static Future<int> get pendingCount async {
    final orders = await getPendingOrders();
    final statuses = await getPendingStatusUpdates();
    final items = await getPendingItemAdditions();
    return orders.length + statuses.length + items.length;
  }
}

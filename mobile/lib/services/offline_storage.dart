import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class OfflineStorage {
  static const _menuKey = 'cached_menu';
  static const _tablesKey = 'cached_tables';
  static const _pendingOrdersKey = 'pending_orders';

  // Cache menu for offline use
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

  // Cache tables
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

  // Queue orders when offline
  static Future<void> queueOrder(Map<String, dynamic> order) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_pendingOrdersKey) ?? [];
    queue.add(jsonEncode(order));
    await prefs.setStringList(_pendingOrdersKey, queue);
  }

  static Future<List<Map<String, dynamic>>> getPendingOrders() async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_pendingOrdersKey) ?? [];
    return queue
        .map((s) => jsonDecode(s) as Map<String, dynamic>)
        .toList();
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
}

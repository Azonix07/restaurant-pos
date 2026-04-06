import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/offline_storage.dart';

class OrderProvider extends ChangeNotifier {
  // Cart state for current order
  List<Map<String, dynamic>> _cartItems = [];
  Map<String, dynamic>? _selectedTable;
  String _orderType = 'dine_in';
  String _customerName = '';
  String _customerPhone = '';
  String _notes = '';

  // Active orders
  List<Map<String, dynamic>> _activeOrders = [];
  bool _loadingOrders = false;

  // Getters
  List<Map<String, dynamic>> get cartItems => _cartItems;
  Map<String, dynamic>? get selectedTable => _selectedTable;
  String get orderType => _orderType;
  String get customerName => _customerName;
  String get customerPhone => _customerPhone;
  String get notes => _notes;
  List<Map<String, dynamic>> get activeOrders => _activeOrders;
  bool get loadingOrders => _loadingOrders;

  int get cartCount => _cartItems.fold(0, (sum, i) => sum + (i['quantity'] as int));
  double get cartTotal => _cartItems.fold(
      0.0, (sum, i) => sum + (i['price'] as num) * (i['quantity'] as int));

  // Cart operations
  void addToCart(Map<String, dynamic> menuItem) {
    final idx = _cartItems.indexWhere((i) => i['menuItem'] == menuItem['_id']);
    if (idx >= 0) {
      _cartItems[idx]['quantity'] = (_cartItems[idx]['quantity'] as int) + 1;
    } else {
      _cartItems.add({
        'menuItem': menuItem['_id'],
        'name': menuItem['name'],
        'price': menuItem['price'],
        'quantity': 1,
        'gstCategory': menuItem['gstCategory'] ?? 'food_non_ac',
        'isVeg': menuItem['isVeg'] ?? true,
        'category': menuItem['category'] ?? '',
      });
    }
    notifyListeners();
  }

  void removeFromCart(int index) {
    _cartItems.removeAt(index);
    notifyListeners();
  }

  void updateQuantity(int index, int qty) {
    if (qty <= 0) {
      _cartItems.removeAt(index);
    } else {
      _cartItems[index]['quantity'] = qty;
    }
    notifyListeners();
  }

  void setTable(Map<String, dynamic>? table) {
    _selectedTable = table;
    notifyListeners();
  }

  void setOrderType(String type) {
    _orderType = type;
    notifyListeners();
  }

  void setCustomerInfo(String name, String phone) {
    _customerName = name;
    _customerPhone = phone;
    notifyListeners();
  }

  void setNotes(String n) {
    _notes = n;
    notifyListeners();
  }

  void clearCart() {
    _cartItems = [];
    _selectedTable = null;
    _orderType = 'dine_in';
    _customerName = '';
    _customerPhone = '';
    _notes = '';
    notifyListeners();
  }

  // Submit order to server
  Future<Map<String, dynamic>> submitOrder() async {
    final payload = {
      'items': _cartItems.map((i) {
        return {
          'menuItem': i['menuItem'],
          'name': i['name'],
          'price': i['price'],
          'quantity': i['quantity'],
          'gstCategory': i['gstCategory'],
        };
      }).toList(),
      'type': _orderType,
      if (_selectedTable != null) 'tableId': _selectedTable!['_id'],
      if (_customerName.isNotEmpty) 'customerName': _customerName,
      if (_customerPhone.isNotEmpty) 'customerPhone': _customerPhone,
      if (_notes.isNotEmpty) 'notes': _notes,
    };

    try {
      final data = await ApiService.post('/orders', payload);
      clearCart();
      await fetchActiveOrders();
      return data;
    } catch (e) {
      // Queue offline
      await OfflineStorage.queueOrder(payload);
      clearCart();
      rethrow;
    }
  }

  // Add items to existing order
  Future<void> addItemsToOrder(String orderId) async {
    final items = _cartItems.map((i) {
      return {
        'menuItem': i['menuItem'],
        'name': i['name'],
        'price': i['price'],
        'quantity': i['quantity'],
        'gstCategory': i['gstCategory'],
      };
    }).toList();

    await ApiService.post('/orders/$orderId/items', {'items': items});
    clearCart();
    await fetchActiveOrders();
  }

  // Fetch active orders
  Future<void> fetchActiveOrders() async {
    _loadingOrders = true;
    notifyListeners();
    try {
      final data = await ApiService.get('/orders/active');
      _activeOrders = List<Map<String, dynamic>>.from(data['orders'] ?? []);
    } catch (_) {}
    _loadingOrders = false;
    notifyListeners();
  }

  // Update order status
  Future<void> updateOrderStatus(String orderId, String status) async {
    await ApiService.patch('/orders/$orderId/status', {'status': status});
    await fetchActiveOrders();
  }
}

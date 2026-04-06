import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/order_provider.dart';
import '../services/api_service.dart';
import '../services/offline_storage.dart';
import 'cart_screen.dart';

class MenuScreen extends StatefulWidget {
  final Map<String, dynamic>? preselectedTable;
  final String? existingOrderId;

  const MenuScreen({super.key, this.preselectedTable, this.existingOrderId});

  @override
  State<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> {
  List<Map<String, dynamic>> _allItems = [];
  List<String> _categories = [];
  String _selectedCategory = 'All';
  String _search = '';
  bool _loading = true;
  bool _vegOnly = false;

  @override
  void initState() {
    super.initState();
    if (widget.preselectedTable != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.read<OrderProvider>().setTable(widget.preselectedTable);
      });
    }
    _fetchMenu();
  }

  Future<void> _fetchMenu() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.get('/menu');
      final items = List<Map<String, dynamic>>.from(data['items'] ?? []);
      _allItems = items.where((i) => i['isAvailable'] == true).toList();
      await OfflineStorage.cacheMenu(_allItems);
    } catch (_) {
      final cached = await OfflineStorage.getCachedMenu();
      _allItems = List<Map<String, dynamic>>.from(cached);
    }
    _categories = ['All', ..._allItems.map((i) => i['category'] as String? ?? '').toSet().toList()..sort()];
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filteredItems {
    var items = _allItems;
    if (_selectedCategory != 'All') {
      items = items.where((i) => i['category'] == _selectedCategory).toList();
    }
    if (_vegOnly) {
      items = items.where((i) => i['isVeg'] == true).toList();
    }
    if (_search.isNotEmpty) {
      final q = _search.toLowerCase();
      items = items.where((i) => (i['name'] as String? ?? '').toLowerCase().contains(q)).toList();
    }
    return items;
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<OrderProvider>();
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.existingOrderId != null ? 'Add Items' : 'Menu'),
        actions: [
          // Veg toggle
          IconButton(
            icon: Icon(
              Icons.eco,
              color: _vegOnly ? const Color(0xFF22C55E) : null,
            ),
            onPressed: () => setState(() => _vegOnly = !_vegOnly),
            tooltip: 'Veg Only',
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search menu...',
                prefixIcon: Icon(Icons.search),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
          // Category chips
          SizedBox(
            height: 44,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _categories.length,
              itemBuilder: (_, i) {
                final cat = _categories[i];
                final selected = _selectedCategory == cat;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(cat),
                    selected: selected,
                    onSelected: (_) =>
                        setState(() => _selectedCategory = cat),
                    selectedColor: Theme.of(context)
                        .colorScheme
                        .primary
                        .withValues(alpha: 0.2),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 4),
          // Menu items
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _filteredItems.isEmpty
                    ? const Center(child: Text('No items found'))
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: _filteredItems.length,
                        itemBuilder: (_, i) =>
                            _buildMenuItem(_filteredItems[i], cart),
                      ),
          ),
        ],
      ),
      // Cart FAB
      floatingActionButton: cart.cartCount > 0
          ? FloatingActionButton.extended(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => CartScreen(
                      existingOrderId: widget.existingOrderId),
                ),
              ),
              icon: const Icon(Icons.shopping_cart),
              label: Text(
                  '${cart.cartCount} items · ₹${cart.cartTotal.toStringAsFixed(0)}'),
            )
          : null,
    );
  }

  Widget _buildMenuItem(
      Map<String, dynamic> item, OrderProvider cart) {
    final isVeg = item['isVeg'] == true;
    final price = (item['price'] as num?)?.toDouble() ?? 0;
    final cartQty = cart.cartItems
        .where((c) => c['menuItem'] == item['_id'])
        .fold(0, (sum, c) => sum + (c['quantity'] as int));

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            // Veg/Non-veg indicator
            Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                border: Border.all(
                    color: isVeg
                        ? const Color(0xFF22C55E)
                        : const Color(0xFFEF4444),
                    width: 2),
                borderRadius: BorderRadius.circular(3),
              ),
              child: Center(
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isVeg
                        ? const Color(0xFF22C55E)
                        : const Color(0xFFEF4444),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Item details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item['name'] as String? ?? '',
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text('₹${price.toStringAsFixed(0)}',
                      style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF6366F1))),
                  if (item['category'] != null)
                    Text(item['category'] as String,
                        style: const TextStyle(
                            fontSize: 11, color: Color(0xFF9CA3AF))),
                ],
              ),
            ),
            // Add button / quantity control
            if (cartQty > 0)
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove, size: 18),
                      onPressed: () {
                        final idx = cart.cartItems
                            .indexWhere((c) => c['menuItem'] == item['_id']);
                        if (idx >= 0) {
                          cart.updateQuantity(idx, cartQty - 1);
                        }
                      },
                      constraints:
                          const BoxConstraints(minWidth: 36, minHeight: 36),
                      padding: EdgeInsets.zero,
                    ),
                    Text('$cartQty',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    IconButton(
                      icon: const Icon(Icons.add, size: 18),
                      onPressed: () => cart.addToCart(item),
                      constraints:
                          const BoxConstraints(minWidth: 36, minHeight: 36),
                      padding: EdgeInsets.zero,
                    ),
                  ],
                ),
              )
            else
              SizedBox(
                height: 36,
                child: ElevatedButton(
                  onPressed: () => cart.addToCart(item),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    textStyle: const TextStyle(fontSize: 13),
                  ),
                  child: const Text('ADD'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

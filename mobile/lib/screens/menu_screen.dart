import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
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
  final _searchController = TextEditingController();

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
    _categories = [
      'All',
      ..._allItems.map((i) => i['category'] as String? ?? '').toSet().toList()..sort()
    ];
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
      items = items
          .where((i) =>
              (i['name'] as String? ?? '').toLowerCase().contains(q) ||
              (i['description'] as String? ?? '').toLowerCase().contains(q))
          .toList();
    }
    return items;
  }

  String _getImageUrl(Map<String, dynamic> item) {
    final image = item['image'] as String?;
    if (image == null || image.isEmpty) return '';
    if (image.startsWith('http')) return image;
    final base = ApiService.baseUrl.replaceFirst('/api', '');
    return '$base$image';
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<OrderProvider>();
    final filtered = _filteredItems;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            floating: true,
            snap: true,
            expandedHeight: 120,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF6366F1), Color(0xFF4F46E5)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
            ),
            title: Text(
              widget.existingOrderId != null ? 'Add Items' : 'Menu',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            actions: [
              GestureDetector(
                onTap: () => setState(() => _vegOnly = !_vegOnly),
                child: Container(
                  margin: const EdgeInsets.only(right: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: _vegOnly
                        ? const Color(0xFF22C55E).withValues(alpha: 0.2)
                        : Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _vegOnly ? const Color(0xFF22C55E) : Colors.white38,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 12, height: 12,
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFF22C55E), width: 2),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Center(
                          child: Container(
                            width: 5, height: 5,
                            decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF22C55E)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text('VEG',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                          color: _vegOnly ? const Color(0xFF22C55E) : Colors.white70)),
                    ],
                  ),
                ),
              ),
            ],
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(56),
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E2E),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: TextField(
                  controller: _searchController,
                  style: const TextStyle(fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Search for dishes, cuisines...',
                    hintStyle: const TextStyle(color: Color(0xFF6B7280), fontSize: 14),
                    prefixIcon: const Icon(Icons.search, color: Color(0xFF6B7280), size: 20),
                    suffixIcon: _search.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.close, size: 18, color: Color(0xFF6B7280)),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _search = '');
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onChanged: (v) => setState(() => _search = v),
                ),
              ),
            ),
          ),

          // Category chips
          SliverToBoxAdapter(
            child: SizedBox(
              height: 48,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: _categories.length,
                itemBuilder: (_, i) {
                  final cat = _categories[i];
                  final selected = _selectedCategory == cat;
                  final count = cat == 'All'
                      ? _allItems.length
                      : _allItems.where((item) => item['category'] == cat).length;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text('$cat ($count)'),
                      selected: selected,
                      onSelected: (_) => setState(() => _selectedCategory = cat),
                      selectedColor: const Color(0xFF6366F1).withValues(alpha: 0.2),
                      showCheckmark: false,
                      labelStyle: TextStyle(fontSize: 12,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        color: selected ? const Color(0xFF6366F1) : const Color(0xFF9CA3AF)),
                    ),
                  );
                },
              ),
            ),
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Text('${filtered.length} items',
                style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280), fontWeight: FontWeight.w500)),
            ),
          ),

          if (_loading)
            const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
          else if (filtered.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.restaurant_menu, size: 64, color: Colors.grey[700]),
                    const SizedBox(height: 12),
                    const Text('No dishes found', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 16)),
                  ],
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) => _buildFoodCard(filtered[i], cart),
                  childCount: filtered.length,
                ),
              ),
            ),
        ],
      ),

      floatingActionButton: cart.cartCount > 0
          ? GestureDetector(
              onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => CartScreen(existingOrderId: widget.existingOrderId))),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF4F46E5)]),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(color: const Color(0xFF6366F1).withValues(alpha: 0.4), blurRadius: 16, offset: const Offset(0, 4)),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(8)),
                      child: Text('${cart.cartCount}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    ),
                    const SizedBox(width: 12),
                    const Text('View Cart', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    const Spacer(),
                    Text('\u20b9${cart.cartTotal.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_forward_ios, size: 14),
                  ],
                ),
              ),
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  Widget _buildFoodCard(Map<String, dynamic> item, OrderProvider cart) {
    final isVeg = item['isVeg'] == true;
    final price = (item['price'] as num?)?.toDouble() ?? 0;
    final name = item['name'] as String? ?? '';
    final desc = item['description'] as String? ?? '';
    final imageUrl = _getImageUrl(item);
    final hasImage = imageUrl.isNotEmpty;
    final prepTime = item['preparationTime'] as int? ?? 15;
    final cartQty = cart.cartItems
        .where((c) => c['menuItem'] == item['_id'])
        .fold(0, (sum, c) => sum + (c['quantity'] as int));

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF2D2D3D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasImage)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              child: SizedBox(
                height: 180, width: double.infinity,
                child: CachedNetworkImage(
                  imageUrl: imageUrl,
                  fit: BoxFit.cover,
                  placeholder: (_, _a) => Container(
                    color: const Color(0xFF252536),
                    child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                  ),
                  errorWidget: (_, _a, _b) => Container(
                    color: const Color(0xFF252536),
                    child: const Icon(Icons.restaurant, size: 48, color: Color(0xFF4B5563)),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Container(
                          width: 16, height: 16,
                          decoration: BoxDecoration(
                            border: Border.all(color: isVeg ? const Color(0xFF22C55E) : const Color(0xFFEF4444), width: 2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Center(child: Container(
                            width: 7, height: 7,
                            decoration: BoxDecoration(shape: BoxShape.circle,
                              color: isVeg ? const Color(0xFF22C55E) : const Color(0xFFEF4444)),
                          )),
                        ),
                        const SizedBox(width: 8),
                        Icon(Icons.timer_outlined, size: 13, color: Colors.grey[500]),
                        const SizedBox(width: 3),
                        Text('$prepTime min', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                      ]),
                      const SizedBox(height: 8),
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, height: 1.2)),
                      if (desc.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(desc, maxLines: 2, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF), height: 1.3)),
                      ],
                      const SizedBox(height: 8),
                      Text('\u20b9${price.toStringAsFixed(0)}',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF6366F1))),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Column(children: [
                  if (!hasImage)
                    Container(
                      width: 100, height: 100,
                      decoration: BoxDecoration(color: const Color(0xFF252536), borderRadius: BorderRadius.circular(12)),
                      child: Icon(isVeg ? Icons.eco : Icons.restaurant,
                        color: (isVeg ? const Color(0xFF22C55E) : const Color(0xFFEF4444)).withValues(alpha: 0.3), size: 40),
                    ),
                  const SizedBox(height: 8),
                  if (cartQty > 0)
                    Container(
                      decoration: BoxDecoration(color: const Color(0xFF6366F1), borderRadius: BorderRadius.circular(10)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        InkWell(
                          onTap: () {
                            final idx = cart.cartItems.indexWhere((c) => c['menuItem'] == item['_id']);
                            if (idx >= 0) cart.updateQuantity(idx, cartQty - 1);
                          },
                          child: const Padding(padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            child: Icon(Icons.remove, size: 18, color: Colors.white)),
                        ),
                        Padding(padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Text('$cartQty', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white))),
                        InkWell(
                          onTap: () => cart.addToCart(item),
                          child: const Padding(padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            child: Icon(Icons.add, size: 18, color: Colors.white)),
                        ),
                      ]),
                    )
                  else
                    SizedBox(
                      width: 100, height: 36,
                      child: OutlinedButton(
                        onPressed: () => cart.addToCart(item),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFF6366F1)),
                          padding: EdgeInsets.zero,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('ADD',
                          style: TextStyle(color: Color(0xFF6366F1), fontWeight: FontWeight.w800, fontSize: 14, letterSpacing: 1)),
                      ),
                    ),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../providers/order_provider.dart';
import '../services/api_service.dart';
import '../services/offline_storage.dart';
import '../theme.dart';
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
      items = items.where((i) =>
          (i['name'] as String? ?? '').toLowerCase().contains(q) ||
          (i['description'] as String? ?? '').toLowerCase().contains(q)).toList();
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
          // App bar with search
          SliverAppBar(
            floating: true,
            snap: true,
            title: Text(widget.existingOrderId != null ? 'Add Items' : 'Menu'),
            actions: [
              GestureDetector(
                onTap: () => setState(() => _vegOnly = !_vegOnly),
                child: Container(
                  margin: const EdgeInsets.only(right: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: _vegOnly ? AppTheme.successBg : AppTheme.surfaceAlt,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _vegOnly ? AppTheme.success : AppTheme.border,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 12, height: 12,
                        decoration: BoxDecoration(
                          border: Border.all(color: AppTheme.success, width: 2),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Center(
                          child: Container(
                            width: 5, height: 5,
                            decoration: const BoxDecoration(shape: BoxShape.circle, color: AppTheme.success),
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text('VEG',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                              color: _vegOnly ? AppTheme.success : AppTheme.textMuted)),
                    ],
                  ),
                ),
              ),
            ],
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(56),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: TextField(
                  controller: _searchController,
                  style: const TextStyle(fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Search dishes...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _search.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _search = '');
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                    isDense: true,
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
                      selectedColor: AppTheme.accentBg,
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        color: selected ? AppTheme.accent : AppTheme.textSecondary,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),

          // Item count
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Text('${filtered.length} items',
                  style: const TextStyle(fontSize: 12, color: AppTheme.textMuted, fontWeight: FontWeight.w500)),
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
                    Icon(Icons.restaurant_menu, size: 56, color: AppTheme.textMuted.withValues(alpha: 0.4)),
                    const SizedBox(height: 12),
                    const Text('No dishes found', style: TextStyle(color: AppTheme.textMuted, fontSize: 15)),
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

      // Cart bar
      floatingActionButton: cart.cartCount > 0
          ? GestureDetector(
              onTap: () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => CartScreen(existingOrderId: widget.existingOrderId))),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                decoration: BoxDecoration(
                  color: AppTheme.accent,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(color: AppTheme.accent.withValues(alpha: 0.35), blurRadius: 16, offset: const Offset(0, 6)),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(8)),
                      child: Text('${cart.cartCount}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Colors.white)),
                    ),
                    const SizedBox(width: 12),
                    const Text('View Cart', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Colors.white)),
                    const Spacer(),
                    Text('₹${cart.cartTotal.toStringAsFixed(0)}',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Colors.white)),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.white),
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
    final cartQty = cart.cartItems
        .where((c) => c['menuItem'] == item['_id'])
        .fold(0, (sum, c) => sum + (c['quantity'] as int));

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasImage)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              child: SizedBox(
                height: 160, width: double.infinity,
                child: CachedNetworkImage(
                  imageUrl: imageUrl,
                  fit: BoxFit.cover,
                  placeholder: (_, _a) => Container(
                    color: AppTheme.surfaceAlt,
                    child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                  ),
                  errorWidget: (_, _a, _b) => Container(
                    color: AppTheme.surfaceAlt,
                    child: Icon(Icons.restaurant, size: 48, color: AppTheme.textMuted.withValues(alpha: 0.3)),
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
                      // Veg indicator
                      Container(
                        width: 16, height: 16,
                        decoration: BoxDecoration(
                          border: Border.all(color: isVeg ? AppTheme.success : AppTheme.danger, width: 2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Center(child: Container(
                          width: 7, height: 7,
                          decoration: BoxDecoration(shape: BoxShape.circle,
                              color: isVeg ? AppTheme.success : AppTheme.danger),
                        )),
                      ),
                      const SizedBox(height: 8),
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      if (desc.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(desc, maxLines: 2, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                      ],
                      const SizedBox(height: 8),
                      Text('₹${price.toStringAsFixed(0)}',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppTheme.accent)),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Column(children: [
                  if (!hasImage)
                    Container(
                      width: 90, height: 90,
                      decoration: BoxDecoration(
                        color: isVeg ? AppTheme.successBg : AppTheme.dangerBg,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(isVeg ? Icons.eco : Icons.restaurant,
                          color: (isVeg ? AppTheme.success : AppTheme.danger).withValues(alpha: 0.4), size: 36),
                    ),
                  const SizedBox(height: 8),
                  if (cartQty > 0)
                    Container(
                      decoration: BoxDecoration(color: AppTheme.accent, borderRadius: BorderRadius.circular(10)),
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
                      width: 90, height: 36,
                      child: OutlinedButton(
                        onPressed: () => cart.addToCart(item),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: AppTheme.accent),
                          padding: EdgeInsets.zero,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('ADD',
                            style: TextStyle(color: AppTheme.accent, fontWeight: FontWeight.w800, fontSize: 14, letterSpacing: 1)),
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

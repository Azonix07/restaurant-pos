import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/offline_storage.dart';
import '../theme.dart';
import 'menu_screen.dart';

class TablesScreen extends StatefulWidget {
  const TablesScreen({super.key});

  @override
  State<TablesScreen> createState() => _TablesScreenState();
}

class _TablesScreenState extends State<TablesScreen> {
  List<Map<String, dynamic>> _tables = [];
  bool _loading = true;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _fetchTables();
  }

  Future<void> _fetchTables() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.get('/tables');
      final tables = List<Map<String, dynamic>>.from(data['tables'] ?? []);
      _tables = tables;
      await OfflineStorage.cacheTables(tables);
    } catch (_) {
      // Load from cache
      final cached = await OfflineStorage.getCachedTables();
      _tables = List<Map<String, dynamic>>.from(cached);
    }
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filteredTables {
    if (_filter == 'all') return _tables;
    return _tables.where((t) => t['status'] == _filter).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tables'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchTables,
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter chips
          SizedBox(
            height: 50,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _filterChip('all', 'All'),
                _filterChip('available', 'Available'),
                _filterChip('occupied', 'Occupied'),
                _filterChip('reserved', 'Reserved'),
              ],
            ),
          ),
          // Table grid
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _fetchTables,
                    child: _filteredTables.isEmpty
                        ? const Center(child: Text('No tables found'))
                        : GridView.builder(
                            padding: const EdgeInsets.all(16),
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 3,
                              crossAxisSpacing: 12,
                              mainAxisSpacing: 12,
                              childAspectRatio: 1,
                            ),
                            itemCount: _filteredTables.length,
                            itemBuilder: (ctx, i) =>
                                _buildTableCard(_filteredTables[i]),
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String value, String label) {
    final selected = _filter == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => setState(() => _filter = value),
        selectedColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2),
        checkmarkColor: Theme.of(context).colorScheme.primary,
      ),
    );
  }

  Widget _buildTableCard(Map<String, dynamic> table) {
    final status = table['status'] as String? ?? 'available';
    final color = AppTheme.statusColor(status);
    final number = table['number']?.toString() ?? table['name'] ?? '?';
    final capacity = table['capacity'] ?? 4;

    return GestureDetector(
      onTap: () => _onTableTap(table),
      child: Container(
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.4), width: 2),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.table_restaurant, color: color, size: 28),
            const SizedBox(height: 4),
            Text('T-$number',
                style: TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 16, color: color)),
            const SizedBox(height: 2),
            Text('$capacity seats',
                style: TextStyle(fontSize: 11, color: color.withValues(alpha: 0.7))),
            const SizedBox(height: 2),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(status.toUpperCase(),
                  style: TextStyle(
                      fontSize: 9, fontWeight: FontWeight.w700, color: color)),
            ),
          ],
        ),
      ),
    );
  }

  void _onTableTap(Map<String, dynamic> table) {
    final status = table['status'] as String? ?? 'available';
    if (status == 'available') {
      // Navigate to menu to create new order for this table
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => MenuScreen(preselectedTable: table),
        ),
      );
    } else if (status == 'occupied') {
      // Show order for this table
      _showTableOrder(table);
    }
  }

  Future<void> _showTableOrder(Map<String, dynamic> table) async {
    final orderId = table['currentOrder'];
    if (orderId == null) return;

    try {
      final id = orderId is Map ? orderId['_id'] : orderId;
      final data = await ApiService.get('/orders/$id');
      final order = data['order'] as Map<String, dynamic>?;
      if (order == null || !mounted) return;

      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Theme.of(context).cardTheme.color,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (ctx) => DraggableScrollableSheet(
          initialChildSize: 0.6,
          minChildSize: 0.3,
          maxChildSize: 0.9,
          expand: false,
          builder: (_, controller) => ListView(
            controller: controller,
            padding: const EdgeInsets.all(20),
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.grey[600],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Text('Table ${table['number'] ?? table['name']}',
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w700)),
              Text('Order #${order['orderNumber'] ?? ''}',
                  style: const TextStyle(
                      color: Color(0xFF9CA3AF), fontSize: 13)),
              const SizedBox(height: 16),
              ...((order['items'] as List?) ?? []).map<Widget>((item) {
                final i = item as Map<String, dynamic>;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: (i['isVeg'] == true)
                              ? const Color(0xFF22C55E)
                              : const Color(0xFFEF4444),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                          child: Text(i['name'] as String? ?? '',
                              style: const TextStyle(fontSize: 15))),
                      Text('×${i['quantity']}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 14)),
                      const SizedBox(width: 12),
                      Text(
                          '₹${((i['price'] as num?) ?? 0) * ((i['quantity'] as num?) ?? 1)}',
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                    ],
                  ),
                );
              }),
              const Divider(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total',
                      style: TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w700)),
                  Text('₹${(order['total'] as num?)?.toStringAsFixed(2) ?? '0.00'}',
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w700)),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => MenuScreen(
                              preselectedTable: table,
                              existingOrderId: id.toString(),
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.add),
                      label: const Text('Add Items'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load order: $e')),
        );
      }
    }
  }
}

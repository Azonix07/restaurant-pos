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
    final available = _tables.where((t) => t['status'] == 'available').length;
    final occupied = _tables.where((t) => t['status'] == 'occupied').length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tables'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined, size: 22),
            onPressed: _fetchTables,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(context, MaterialPageRoute(builder: (_) => const MenuScreen()));
        },
        icon: const Icon(Icons.shopping_bag_outlined, size: 18),
        label: const Text('Takeaway', style: TextStyle(fontWeight: FontWeight.w700)),
        elevation: 2,
      ),
      body: Column(
        children: [
          // Quick stats row
          if (!_loading && _tables.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Row(
                children: [
                  _statChip('$available Free', AppTheme.success, AppTheme.successBg),
                  const SizedBox(width: 8),
                  _statChip('$occupied Occupied', AppTheme.danger, AppTheme.dangerBg),
                  const SizedBox(width: 8),
                  _statChip('${_tables.length} Total', AppTheme.textMuted, AppTheme.surfaceAlt),
                ],
              ),
            ),

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
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.table_restaurant_outlined, size: 56, color: AppTheme.textMuted.withValues(alpha: 0.5)),
                                const SizedBox(height: 12),
                                const Text('No tables found', style: TextStyle(color: AppTheme.textMuted, fontSize: 15)),
                              ],
                            ),
                          )
                        : GridView.builder(
                            padding: const EdgeInsets.all(16),
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 3,
                              crossAxisSpacing: 12,
                              mainAxisSpacing: 12,
                              childAspectRatio: 0.9,
                            ),
                            itemCount: _filteredTables.length,
                            itemBuilder: (ctx, i) => _buildTableCard(_filteredTables[i]),
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _statChip(String label, Color color, Color bg) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Center(
          child: Text(label,
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: color)),
        ),
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
        selectedColor: AppTheme.accentBg,
        checkmarkColor: AppTheme.accent,
        labelStyle: TextStyle(
          fontSize: 13,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: selected ? AppTheme.accent : AppTheme.textSecondary,
        ),
      ),
    );
  }

  Widget _buildTableCard(Map<String, dynamic> table) {
    final status = table['status'] as String? ?? 'available';
    final color = AppTheme.statusColor(status);
    final bgColor = AppTheme.statusBgColor(status);
    final number = table['number']?.toString() ?? table['name'] ?? '?';
    final capacity = table['capacity'] ?? 4;
    final isOccupied = status == 'occupied';

    String? timeLabel;
    if (isOccupied && table['occupiedAt'] != null) {
      try {
        final occupiedAt = DateTime.parse(table['occupiedAt'].toString()).toLocal();
        final diff = DateTime.now().difference(occupiedAt);
        if (diff.inMinutes < 60) {
          timeLabel = '${diff.inMinutes}m';
        } else {
          timeLabel = '${diff.inHours}h ${diff.inMinutes % 60}m';
        }
      } catch (_) {}
    }

    return GestureDetector(
      onTap: () => _onTableTap(table),
      child: Container(
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.3), width: 1.5),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Time badge for occupied
            if (isOccupied && timeLabel != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.warning,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(timeLabel,
                    style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white)),
              )
            else
              const SizedBox(height: 14),
            const SizedBox(height: 4),
            Text('T-$number',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: color)),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.people_outline, size: 13, color: color.withValues(alpha: 0.7)),
                const SizedBox(width: 3),
                Text('$capacity', style: TextStyle(fontSize: 12, color: color.withValues(alpha: 0.7), fontWeight: FontWeight.w500)),
              ],
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                status.toUpperCase(),
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color, letterSpacing: 0.5),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _onTableTap(Map<String, dynamic> table) {
    final status = table['status'] as String? ?? 'available';
    if (status == 'available') {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => MenuScreen(preselectedTable: table)),
      );
    } else if (status == 'occupied') {
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
                  width: 40, height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppTheme.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Text('Table ${table['number'] ?? table['name']}',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              Text('Order #${order['orderNumber'] ?? ''}',
                  style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
              const SizedBox(height: 16),
              ...List<Map<String, dynamic>>.from(order['items'] ?? []).map((item) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Text('${item['quantity']}×',
                          style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.accent)),
                      const SizedBox(width: 8),
                      Expanded(child: Text(
                        (item['name'] ?? item['menuItem']?['name'] ?? '').toString(),
                        style: const TextStyle(fontSize: 14),
                      )),
                      Text('₹${((item['price'] as num?) ?? 0) * ((item['quantity'] as num?) ?? 1)}',
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                    ],
                  ),
                );
              }),
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  Text('₹${((order['total'] as num?)?.toDouble() ?? 0).toStringAsFixed(0)}',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppTheme.accent)),
                ],
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                icon: const Icon(Icons.add),
                label: const Text('Add More Items'),
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.push(context,
                    MaterialPageRoute(builder: (_) => MenuScreen(
                      preselectedTable: table,
                      existingOrderId: order['_id'],
                    )),
                  );
                },
              ),
            ],
          ),
        ),
      );
    } catch (_) {}
  }
}

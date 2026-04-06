import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});
  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _loading = true;
  List<Map<String, dynamic>> _materials = [];
  List<Map<String, dynamic>> _alerts = [];
  List<Map<String, dynamic>> _expiring = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _fetchData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService.get('/stock/materials').catchError((_) => <String, dynamic>{'materials': []}),
        ApiService.get('/stock/alerts').catchError((_) => <String, dynamic>{'alerts': []}),
        ApiService.get('/stock/expiring').catchError((_) => <String, dynamic>{'items': []}),
      ]);
      if (mounted) {
        setState(() {
          final matRes = results[0] as Map<String, dynamic>;
          _materials = List<Map<String, dynamic>>.from(matRes['materials'] ?? matRes['data'] ?? []);
          final alertRes = results[1] as Map<String, dynamic>;
          _alerts = List<Map<String, dynamic>>.from(alertRes['alerts'] ?? alertRes['data'] ?? []);
          final expRes = results[2] as Map<String, dynamic>;
          _expiring = List<Map<String, dynamic>>.from(expRes['items'] ?? expRes['data'] ?? []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventory'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchData)],
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(text: 'Stock (${_materials.length})'),
            Tab(text: 'Alerts (${_alerts.length})'),
            Tab(text: 'Expiring (${_expiring.length})'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildStockTab(),
                _buildAlertsTab(),
                _buildExpiringTab(),
              ],
            ),
    );
  }

  Widget _buildStockTab() {
    if (_materials.isEmpty) return _emptyState('No stock materials found', Icons.inventory_2_outlined);
    return RefreshIndicator(
      onRefresh: _fetchData,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _materials.length,
        itemBuilder: (ctx, i) => _buildMaterialCard(_materials[i]),
      ),
    );
  }

  Widget _buildMaterialCard(Map<String, dynamic> m) {
    final name = m['name']?.toString() ?? 'Unknown';
    final qty = m['currentStock'] ?? m['quantity'] ?? 0;
    final unit = m['unit']?.toString() ?? '';
    final minQty = m['minimumStock'] ?? m['minStock'] ?? m['reorderLevel'] ?? 0;
    final isLow = (qty is num && minQty is num) && qty <= minQty;
    final category = m['category']?.toString() ?? '';
    final cost = m['costPerUnit'] ?? m['cost'] ?? m['price'];

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isLow ? AppTheme.danger.withValues(alpha: 0.3) : AppTheme.border),
      ),
      child: Row(
        children: [
          // Status indicator
          Container(
            width: 4, height: 40,
            decoration: BoxDecoration(
              color: isLow ? AppTheme.danger : AppTheme.success,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 12),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                Row(
                  children: [
                    if (category.isNotEmpty) ...[
                      Text(category, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                      const Text(' • ', style: TextStyle(color: AppTheme.textMuted)),
                    ],
                    if (cost != null) Text('₹$cost/$unit', style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                  ],
                ),
              ],
            ),
          ),
          // Quantity
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$qty $unit',
                style: TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 15,
                  color: isLow ? AppTheme.danger : AppTheme.textPrimary,
                ),
              ),
              Text(
                'Min: $minQty',
                style: TextStyle(fontSize: 10, color: isLow ? AppTheme.danger : AppTheme.textMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAlertsTab() {
    if (_alerts.isEmpty) return _emptyState('No stock alerts', Icons.notifications_none);
    return RefreshIndicator(
      onRefresh: _fetchData,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _alerts.length,
        itemBuilder: (ctx, i) {
          final a = _alerts[i];
          final name = a['materialName'] ?? a['name'] ?? 'Item';
          final type = a['alertType'] ?? a['type'] ?? 'low_stock';
          final current = a['currentStock'] ?? a['quantity'] ?? 0;
          final min = a['minimumStock'] ?? a['minStock'] ?? 0;
          final isReorder = type.toString().contains('reorder');

          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isReorder ? AppTheme.warningBg : AppTheme.dangerBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: (isReorder ? AppTheme.warning : AppTheme.danger).withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Icon(
                  isReorder ? Icons.warning_amber : Icons.error_outline,
                  color: isReorder ? AppTheme.warning : AppTheme.danger,
                  size: 18,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name.toString(), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      Text(
                        'Current: $current | Minimum: $min',
                        style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: (isReorder ? AppTheme.warning : AppTheme.danger).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    isReorder ? 'REORDER' : 'LOW',
                    style: TextStyle(
                      fontSize: 9, fontWeight: FontWeight.w700,
                      color: isReorder ? AppTheme.warning : AppTheme.danger,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildExpiringTab() {
    if (_expiring.isEmpty) return _emptyState('No expiring items', Icons.event_available);
    return RefreshIndicator(
      onRefresh: _fetchData,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _expiring.length,
        itemBuilder: (ctx, i) {
          final e = _expiring[i];
          final name = e['materialName'] ?? e['name'] ?? 'Item';
          final batch = e['batchNumber'] ?? e['batch'] ?? '';
          final expiry = e['expiryDate'] ?? e['expiry'] ?? '';
          final qty = e['quantity'] ?? e['stock'] ?? 0;
          final daysLeft = e['daysUntilExpiry'] ?? e['daysLeft'];
          final isUrgent = daysLeft != null && (daysLeft as num) <= 7;

          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isUrgent ? AppTheme.dangerBg : AppTheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isUrgent ? AppTheme.danger.withValues(alpha: 0.2) : AppTheme.border),
            ),
            child: Row(
              children: [
                Icon(Icons.timer_outlined, size: 18, color: isUrgent ? AppTheme.danger : AppTheme.warning),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name.toString(), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      Text(
                        '${batch.toString().isNotEmpty ? 'Batch: $batch • ' : ''}Qty: $qty',
                        style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (daysLeft != null)
                      Text(
                        '$daysLeft days',
                        style: TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 13,
                          color: isUrgent ? AppTheme.danger : AppTheme.warning,
                        ),
                      ),
                    if (expiry.toString().isNotEmpty)
                      Text(expiry.toString().split('T').first, style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _emptyState(String msg, IconData icon) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 48, color: AppTheme.textMuted),
          const SizedBox(height: 8),
          Text(msg, style: const TextStyle(color: AppTheme.textMuted, fontSize: 13)),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../theme.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});
  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  bool _loading = true;
  Map<String, dynamic> _data = {};
  List<Map<String, dynamic>> _recentOrders = [];

  @override
  void initState() {
    super.initState();
    _fetchDashboard();
  }

  Future<void> _fetchDashboard() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService.get('/reports/daily').catchError((_) => <String, dynamic>{}),
        ApiService.get('/orders/active').catchError((_) => <String, dynamic>{'orders': []}),
        ApiService.get('/tables').catchError((_) => <String, dynamic>{'tables': []}),
        ApiService.get('/monitoring/dashboard').catchError((_) => <String, dynamic>{}),
      ]);
      if (mounted) {
        final daily = results[0] as Map<String, dynamic>;
        final ordersResp = results[1] as Map<String, dynamic>;
        final tablesResp = results[2] as Map<String, dynamic>;
        final monitorResp = results[3] as Map<String, dynamic>;

        final tables = List<Map<String, dynamic>>.from(tablesResp['tables'] ?? []);
        final occupied = tables.where((t) => t['status'] == 'occupied').length;

        setState(() {
          _data = {
            'todayRevenue': daily['totalRevenue'] ?? daily['revenue'] ?? 0,
            'todayOrders': daily['totalOrders'] ?? daily['orderCount'] ?? 0,
            'avgOrderValue': daily['averageOrder'] ?? daily['avgOrderValue'] ?? 0,
            'activeOrders': (ordersResp['orders'] as List?)?.length ?? 0,
            'tablesOccupied': occupied,
            'totalTables': tables.length,
            'alerts': monitorResp['alertCount'] ?? monitorResp['activeAlerts'] ?? 0,
            'topItems': daily['topItems'] ?? [],
            'peakHour': daily['peakHour'] ?? '',
          };
          _recentOrders = List<Map<String, dynamic>>.from(
            (ordersResp['orders'] as List?)?.take(5) ?? [],
          );
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
        title: const Text('Dashboard'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchDashboard),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchDashboard,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Revenue card
                  _buildHeroCard(),
                  const SizedBox(height: 16),
                  // Stat grid
                  _buildStatGrid(),
                  const SizedBox(height: 20),
                  // Recent orders
                  Text('RECENT ORDERS', style: Theme.of(context).textTheme.labelSmall),
                  const SizedBox(height: 8),
                  if (_recentOrders.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 20),
                      child: Center(child: Text('No active orders', style: TextStyle(color: AppTheme.textMuted))),
                    )
                  else
                    ..._recentOrders.map(_buildOrderTile),
                  const SizedBox(height: 16),
                  // Top items
                  if ((_data['topItems'] as List?)?.isNotEmpty == true) ...[
                    Text('TOP SELLING ITEMS', style: Theme.of(context).textTheme.labelSmall),
                    const SizedBox(height: 8),
                    ...List<Map<String, dynamic>>.from(_data['topItems'] ?? [])
                        .take(5)
                        .map(_buildTopItem),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildHeroCard() {
    final revenue = (_data['todayRevenue'] as num?)?.toDouble() ?? 0;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.accent,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("Today's Revenue", style: TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 4),
          Text(
            '₹${NumberFormat('#,##0').format(revenue)}',
            style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _heroPill(Icons.receipt_long, '${_data['todayOrders'] ?? 0} orders'),
              const SizedBox(width: 10),
              _heroPill(Icons.trending_up, 'Avg ₹${(_data['avgOrderValue'] as num?)?.toStringAsFixed(0) ?? '0'}'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroPill(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.white70),
          const SizedBox(width: 4),
          Text(text, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildStatGrid() {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        _statCard('Active Orders', '${_data['activeOrders'] ?? 0}', Icons.restaurant, AppTheme.info),
        _statCard('Tables', '${_data['tablesOccupied'] ?? 0}/${_data['totalTables'] ?? 0}', Icons.table_restaurant, AppTheme.success),
        _statCard('Alerts', '${_data['alerts'] ?? 0}', Icons.warning_amber, AppTheme.warning),
        _statCard('Peak Hour', _data['peakHour']?.toString() ?? '—', Icons.schedule, AppTheme.accent),
      ],
    );
  }

  Widget _statCard(String label, String value, IconData icon, Color color) {
    return SizedBox(
      width: (MediaQuery.of(context).size.width - 42) / 2,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.border),
        ),
        child: Row(
          children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                  Text(label, style: const TextStyle(color: AppTheme.textMuted, fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderTile(Map<String, dynamic> order) {
    final status = order['status']?.toString() ?? '';
    final sc = AppTheme.statusColor(status);
    final orderNum = order['orderNumber']?.toString() ?? '';
    final total = (order['total'] as num?)?.toDouble() ?? 0;
    final time = order['createdAt'] != null
        ? DateFormat('h:mm a').format(DateTime.parse(order['createdAt']).toLocal())
        : '';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        children: [
          Text('#$orderNum', style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: sc.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(4)),
            child: Text(status.toUpperCase(), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: sc)),
          ),
          const Spacer(),
          Text('₹${total.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(width: 8),
          Text(time, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
        ],
      ),
    );
  }

  Widget _buildTopItem(Map<String, dynamic> item) {
    final name = item['name']?.toString() ?? item['_id']?.toString() ?? '';
    final qty = item['quantity'] ?? item['count'] ?? 0;
    final rev = (item['revenue'] as num?)?.toDouble() ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        children: [
          Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w500))),
          Text('${qty}x', style: const TextStyle(color: AppTheme.textMuted, fontSize: 12)),
          const SizedBox(width: 12),
          Text('₹${rev.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

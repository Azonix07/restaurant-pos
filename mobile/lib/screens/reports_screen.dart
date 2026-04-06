import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../theme.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});
  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _loading = true;
  Map<String, dynamic> _sales = {};
  Map<String, dynamic> _items = {};
  Map<String, dynamic> _tax = {};
  Map<String, dynamic> _profitLoss = {};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _fetchReports();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchReports() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService.get('/reports/daily').catchError((_) => <String, dynamic>{}),
        ApiService.get('/reports/items').catchError((_) => <String, dynamic>{}),
        ApiService.get('/reports/tax').catchError((_) => <String, dynamic>{}),
        ApiService.get('/reports/profit-loss').catchError((_) => <String, dynamic>{}),
      ]);
      if (mounted) {
        setState(() {
          _sales = results[0] as Map<String, dynamic>;
          _items = results[1] as Map<String, dynamic>;
          _tax = results[2] as Map<String, dynamic>;
          _profitLoss = results[3] as Map<String, dynamic>;
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
        title: const Text('Reports'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchReports)],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          labelColor: AppTheme.accent,
          unselectedLabelColor: AppTheme.textMuted,
          indicatorColor: AppTheme.accent,
          tabs: const [
            Tab(text: 'Sales'),
            Tab(text: 'Items'),
            Tab(text: 'Tax/GST'),
            Tab(text: 'P&L'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildSalesTab(),
                _buildItemsTab(),
                _buildTaxTab(),
                _buildPLTab(),
              ],
            ),
    );
  }

  Widget _buildSalesTab() {
    final revenue = (_sales['totalRevenue'] ?? _sales['revenue'] ?? 0) as num;
    final orders = _sales['totalOrders'] ?? _sales['orderCount'] ?? 0;
    final avg = (_sales['averageOrder'] ?? _sales['avgOrderValue'] ?? 0) as num;
    final hourly = List<Map<String, dynamic>>.from(_sales['hourlyBreakdown'] ?? []);

    return RefreshIndicator(
      onRefresh: _fetchReports,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _metricRow('Total Revenue', '₹${NumberFormat('#,##0').format(revenue)}', AppTheme.success),
          _metricRow('Total Orders', '$orders', AppTheme.info),
          _metricRow('Avg Order Value', '₹${avg.toStringAsFixed(0)}', AppTheme.accent),
          if (hourly.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('HOURLY BREAKDOWN', style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 8),
            ...hourly.map((h) => _hourRow(h)),
          ],
        ],
      ),
    );
  }

  Widget _buildItemsTab() {
    final items = List<Map<String, dynamic>>.from(_items['items'] ?? _items['topItems'] ?? []);
    return RefreshIndicator(
      onRefresh: _fetchReports,
      child: items.isEmpty
          ? const Center(child: Text('No item data', style: TextStyle(color: AppTheme.textMuted)))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              itemBuilder: (ctx, i) {
                final item = items[i];
                final name = item['name'] ?? item['_id'] ?? '';
                final qty = item['quantity'] ?? item['count'] ?? 0;
                final rev = (item['revenue'] as num?)?.toDouble() ?? 0;
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
                      Container(
                        width: 28, height: 28,
                        decoration: BoxDecoration(
                          color: AppTheme.accentBg,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Center(child: Text('${i + 1}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.accent, fontSize: 12))),
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Text(name.toString(), style: const TextStyle(fontWeight: FontWeight.w500))),
                      Text('${qty}x', style: const TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                      const SizedBox(width: 12),
                      Text('₹${rev.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w700)),
                    ],
                  ),
                );
              },
            ),
    );
  }

  Widget _buildTaxTab() {
    final totalTax = (_tax['totalTax'] ?? _tax['gstCollected'] ?? 0) as num;
    final cgst = (_tax['cgst'] ?? 0) as num;
    final sgst = (_tax['sgst'] ?? 0) as num;
    final taxable = (_tax['taxableAmount'] ?? 0) as num;
    return RefreshIndicator(
      onRefresh: _fetchReports,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _metricRow('Total Tax Collected', '₹${NumberFormat('#,##0').format(totalTax)}', AppTheme.warning),
          _metricRow('CGST', '₹${NumberFormat('#,##0').format(cgst)}', AppTheme.textSecondary),
          _metricRow('SGST', '₹${NumberFormat('#,##0').format(sgst)}', AppTheme.textSecondary),
          _metricRow('Taxable Amount', '₹${NumberFormat('#,##0').format(taxable)}', AppTheme.info),
        ],
      ),
    );
  }

  Widget _buildPLTab() {
    final revenue = (_profitLoss['revenue'] ?? _profitLoss['totalRevenue'] ?? 0) as num;
    final expenses = (_profitLoss['expenses'] ?? _profitLoss['totalExpenses'] ?? 0) as num;
    final profit = (_profitLoss['profit'] ?? _profitLoss['netProfit'] ?? (revenue - expenses)) as num;
    final isProfit = profit >= 0;

    return RefreshIndicator(
      onRefresh: _fetchReports,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _metricRow('Revenue', '₹${NumberFormat('#,##0').format(revenue)}', AppTheme.success),
          _metricRow('Expenses', '₹${NumberFormat('#,##0').format(expenses)}', AppTheme.danger),
          const Divider(height: 24),
          _metricRow(
            isProfit ? 'Net Profit' : 'Net Loss',
            '₹${NumberFormat('#,##0').format(profit.abs())}',
            isProfit ? AppTheme.success : AppTheme.danger,
          ),
        ],
      ),
    );
  }

  Widget _metricRow(String label, String value, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppTheme.textSecondary)),
          Text(value, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: color)),
        ],
      ),
    );
  }

  Widget _hourRow(Map<String, dynamic> h) {
    final hour = h['hour']?.toString() ?? '';
    final orders = h['orders'] ?? h['count'] ?? 0;
    final revenue = (h['revenue'] as num?)?.toDouble() ?? 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(width: 60, child: Text(hour, style: const TextStyle(fontSize: 12, color: AppTheme.textMuted))),
          Expanded(
            child: Container(
              height: 22,
              decoration: BoxDecoration(
                color: AppTheme.accentBg,
                borderRadius: BorderRadius.circular(4),
              ),
              alignment: Alignment.centerLeft,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text('$orders orders', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppTheme.accent)),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(width: 70, child: Text('₹${revenue.toStringAsFixed(0)}', textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}

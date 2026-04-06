import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

class StaffScreen extends StatefulWidget {
  const StaffScreen({super.key});
  @override
  State<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends State<StaffScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _staff = [];
  Map<String, dynamic> _peakHours = {};

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService.get('/reports/staff-performance').catchError((_) => <String, dynamic>{'staff': []}),
        ApiService.get('/reports/peak-hours').catchError((_) => <String, dynamic>{}),
      ]);
      if (mounted) {
        setState(() {
          final staffRes = results[0] as Map<String, dynamic>;
          _staff = List<Map<String, dynamic>>.from(staffRes['staff'] ?? staffRes['data'] ?? []);
          _peakHours = results[1] as Map<String, dynamic>;
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
        title: const Text('Staff Performance'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchData)],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Peak hours card
                  _buildPeakHoursCard(),
                  const SizedBox(height: 20),

                  // Staff list
                  Text('STAFF SUMMARY', style: Theme.of(context).textTheme.labelSmall),
                  const SizedBox(height: 8),
                  if (_staff.isEmpty)
                    _emptyState()
                  else
                    ..._staff.asMap().entries.map((e) => _buildStaffCard(e.value, e.key)),
                ],
              ),
            ),
    );
  }

  Widget _buildPeakHoursCard() {
    final hours = List<Map<String, dynamic>>.from(_peakHours['hourly'] ?? _peakHours['hours'] ?? []);
    final busiestHour = _peakHours['busiestHour'] ?? _peakHours['peakHour'];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)]),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.schedule, color: Colors.white70, size: 18),
              const SizedBox(width: 6),
              const Text('Peak Hours', style: TextStyle(color: Colors.white70, fontSize: 13)),
              const Spacer(),
              if (busiestHour != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(8)),
                  child: Text('Busiest: $busiestHour', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                ),
            ],
          ),
          if (hours.isNotEmpty) ...[
            const SizedBox(height: 12),
            SizedBox(
              height: 60,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: hours.take(12).map((h) {
                  final count = (h['orders'] ?? h['count'] ?? 0) as num;
                  final maxCount = hours.fold<num>(1, (m, hh) => ((hh['orders'] ?? hh['count'] ?? 0) as num) > m ? (hh['orders'] ?? hh['count'] ?? 0) as num : m);
                  final pct = maxCount > 0 ? count / maxCount : 0.0;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 1),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Flexible(
                            child: FractionallySizedBox(
                              heightFactor: pct.clamp(0.05, 1.0).toDouble(),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: pct > 0.7 ? 0.9 : 0.4),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${h['hour'] ?? ''}',
                            style: const TextStyle(color: Colors.white60, fontSize: 7),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStaffCard(Map<String, dynamic> staff, int index) {
    final name = staff['name']?.toString() ?? staff['staffName']?.toString() ?? 'Staff ${index + 1}';
    final role = staff['role']?.toString() ?? '';
    final ordersHandled = staff['ordersHandled'] ?? staff['orders'] ?? 0;
    final revenue = staff['revenue'] ?? staff['totalRevenue'] ?? 0;
    final avgTime = staff['avgServiceTime'] ?? staff['avgTime'];
    final rating = staff['rating'];

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        children: [
          // Rank
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              color: index < 3 ? AppTheme.accent.withValues(alpha: 0.1) : AppTheme.background,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                '${index + 1}',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: index < 3 ? AppTheme.accent : AppTheme.textMuted,
                  fontSize: 14,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                if (role.isNotEmpty) Text(role, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
              ],
            ),
          ),
          // Stats
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('$ordersHandled orders', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
              Text(
                '₹${_formatNum(revenue)}',
                style: const TextStyle(fontSize: 11, color: AppTheme.success, fontWeight: FontWeight.w600),
              ),
              if (avgTime != null) Text('Avg: ${avgTime}min', style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
              if (rating != null)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.star, size: 10, color: AppTheme.warning),
                    Text(' $rating', style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatNum(dynamic val) {
    if (val is num) {
      if (val >= 1000) return '${(val / 1000).toStringAsFixed(1)}K';
      return val.toStringAsFixed(val.truncateToDouble() == val ? 0 : 2);
    }
    return val?.toString() ?? '0';
  }

  Widget _emptyState() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: const Center(
        child: Column(
          children: [
            Icon(Icons.people_outline, size: 40, color: AppTheme.textMuted),
            SizedBox(height: 8),
            Text('No staff data available', style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
          ],
        ),
      ),
    );
  }
}

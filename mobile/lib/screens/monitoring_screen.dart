import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../theme.dart';

class MonitoringScreen extends StatefulWidget {
  const MonitoringScreen({super.key});
  @override
  State<MonitoringScreen> createState() => _MonitoringScreenState();
}

class _MonitoringScreenState extends State<MonitoringScreen> {
  bool _loading = true;
  Map<String, dynamic> _dashboard = {};
  List<Map<String, dynamic>> _alerts = [];
  List<Map<String, dynamic>> _fraudAlerts = [];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService.get('/monitoring/dashboard').catchError((_) => <String, dynamic>{}),
        ApiService.get('/monitoring/alerts').catchError((_) => <String, dynamic>{'alerts': []}),
        ApiService.get('/fraud/reconciliation').catchError((_) => <String, dynamic>{'alerts': []}),
      ]);
      if (mounted) {
        setState(() {
          _dashboard = results[0] as Map<String, dynamic>;
          _alerts = List<Map<String, dynamic>>.from((results[1] as Map)['alerts'] ?? []);
          _fraudAlerts = List<Map<String, dynamic>>.from((results[2] as Map)['alerts'] ?? (results[2] as Map)['discrepancies'] ?? []);
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
        title: const Text('Monitoring'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchData)],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // System status
                  _buildSystemStatus(),
                  const SizedBox(height: 16),

                  // Quick stats
                  _buildQuickStats(),
                  const SizedBox(height: 20),

                  // Fraud alerts
                  if (_fraudAlerts.isNotEmpty) ...[
                    _sectionHeader('FRAUD ALERTS', AppTheme.danger, _fraudAlerts.length),
                    const SizedBox(height: 8),
                    ..._fraudAlerts.take(10).map(_buildFraudAlert),
                    const SizedBox(height: 16),
                  ],

                  // System alerts
                  _sectionHeader('SYSTEM ALERTS', AppTheme.warning, _alerts.length),
                  const SizedBox(height: 8),
                  if (_alerts.isEmpty)
                    _emptyState('No alerts — everything looks good!')
                  else
                    ..._alerts.take(15).map(_buildAlert),
                ],
              ),
            ),
    );
  }

  Widget _buildSystemStatus() {
    final uptime = _dashboard['uptime'];
    final db = _dashboard['db'] ?? _dashboard['database'] ?? 'unknown';
    final memory = _dashboard['memory'] ?? '';
    final isHealthy = db == 'connected';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isHealthy ? AppTheme.successBg : AppTheme.dangerBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: (isHealthy ? AppTheme.success : AppTheme.danger).withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: (isHealthy ? AppTheme.success : AppTheme.danger).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isHealthy ? Icons.check_circle : Icons.error,
              color: isHealthy ? AppTheme.success : AppTheme.danger,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isHealthy ? 'System Healthy' : 'System Issues',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: isHealthy ? AppTheme.success : AppTheme.danger),
                ),
                Text(
                  'DB: $db • Mem: $memory${uptime != null ? ' • Up: ${(uptime as num).toInt()}s' : ''}',
                  style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickStats() {
    final activeOrders = _dashboard['activeOrders'] ?? 0;
    final connectedDevices = _dashboard['connectedDevices'] ?? _dashboard['devices'] ?? 0;
    final pendingKOTs = _dashboard['pendingKOTs'] ?? _dashboard['pendingKot'] ?? 0;

    return Row(
      children: [
        _quickStat('Active Orders', '$activeOrders', Icons.receipt, AppTheme.info),
        const SizedBox(width: 10),
        _quickStat('Devices', '$connectedDevices', Icons.devices, AppTheme.accent),
        const SizedBox(width: 10),
        _quickStat('Pending KOT', '$pendingKOTs', Icons.kitchen, AppTheme.warning),
      ],
    );
  }

  Widget _quickStat(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.border),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 6),
            Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            Text(label, style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(String title, Color color, int count) {
    return Row(
      children: [
        Text(title, style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(width: 8),
        if (count > 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
            child: Text('$count', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
          ),
      ],
    );
  }

  Widget _buildFraudAlert(Map<String, dynamic> alert) {
    final type = alert['type']?.toString() ?? alert['alertType']?.toString() ?? 'Fraud Alert';
    final msg = alert['message']?.toString() ?? alert['description']?.toString() ?? '';
    final severity = alert['severity']?.toString() ?? 'high';
    final time = alert['createdAt'] != null
        ? DateFormat('MMM d, h:mm a').format(DateTime.parse(alert['createdAt']).toLocal())
        : '';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.dangerBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.danger.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.gpp_bad, size: 16, color: AppTheme.danger),
              const SizedBox(width: 6),
              Expanded(child: Text(type, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppTheme.danger))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: severity == 'high' ? AppTheme.danger : AppTheme.warning,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(severity.toUpperCase(), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
            ],
          ),
          if (msg.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(msg, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
          ],
          if (time.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(time, style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
          ],
        ],
      ),
    );
  }

  Widget _buildAlert(Map<String, dynamic> alert) {
    final type = alert['type']?.toString() ?? alert['alertType']?.toString() ?? 'Alert';
    final msg = alert['message']?.toString() ?? '';
    final level = alert['level']?.toString() ?? alert['severity']?.toString() ?? 'info';
    final time = alert['createdAt'] != null
        ? DateFormat('h:mm a').format(DateTime.parse(alert['createdAt']).toLocal())
        : '';
    final color = level == 'error' ? AppTheme.danger : level == 'warning' ? AppTheme.warning : AppTheme.info;

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            level == 'error' ? Icons.error_outline : level == 'warning' ? Icons.warning_amber : Icons.info_outline,
            size: 16, color: color,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(type, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: color)),
                if (msg.isNotEmpty) Text(msg, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
              ],
            ),
          ),
          Text(time, style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
        ],
      ),
    );
  }

  Widget _emptyState(String msg) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 30),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.check_circle_outline, size: 40, color: AppTheme.success.withValues(alpha: 0.5)),
            const SizedBox(height: 8),
            Text(msg, style: const TextStyle(color: AppTheme.textMuted, fontSize: 13)),
          ],
        ),
      ),
    );
  }
}

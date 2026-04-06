import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/network_service.dart';
import '../services/api_service.dart';

class ConnectionScreen extends StatefulWidget {
  const ConnectionScreen({super.key});

  @override
  State<ConnectionScreen> createState() => _ConnectionScreenState();
}

class _ConnectionScreenState extends State<ConnectionScreen> {
  final _lanController = TextEditingController();
  final _onlineController = TextEditingController();
  bool _testingLan = false;
  bool _testingOnline = false;

  @override
  void initState() {
    super.initState();
    final net = NetworkService.instance;
    _lanController.text = net.lanUrl ?? '';
    _onlineController.text = net.onlineUrl ?? '';
  }

  Future<void> _testAndSave(String url, bool isLan) async {
    setState(() {
      if (isLan) _testingLan = true; else _testingOnline = true;
    });

    final ok = await ApiService.testConnection(url);

    if (ok) {
      final net = NetworkService.instance;
      if (isLan) {
        await net.setLanUrl(url);
      } else {
        await net.setOnlineUrl(url);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${isLan ? 'LAN' : 'Online'} server connected!'),
            backgroundColor: const Color(0xFF22C55E),
          ),
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Cannot reach ${isLan ? 'LAN' : 'Online'} server'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }

    setState(() {
      if (isLan) _testingLan = false; else _testingOnline = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final net = context.watch<NetworkService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Connection Setup')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Connection status card
          _buildStatusCard(net),

          const SizedBox(height: 20),

          // Connection mode
          _buildModeSelector(net),

          const SizedBox(height: 20),

          // LAN Server
          _buildServerCard(
            label: 'LAN SERVER (WiFi)',
            icon: Icons.wifi,
            iconColor: const Color(0xFF22C55E),
            hint: 'http://192.168.1.100:5001',
            controller: _lanController,
            isTesting: _testingLan,
            isActive: net.activeConnection == ConnectionType.lan,
            onTest: () => _testAndSave(_lanController.text.trim(), true),
            onScan: () => _showScanDialog(net),
          ),

          const SizedBox(height: 16),

          // Online Server
          _buildServerCard(
            label: 'ONLINE SERVER (Cloud)',
            icon: Icons.cloud,
            iconColor: const Color(0xFF6366F1),
            hint: 'https://your-server.com:5001',
            controller: _onlineController,
            isTesting: _testingOnline,
            isActive: net.activeConnection == ConnectionType.online,
            onTest: () => _testAndSave(_onlineController.text.trim(), false),
          ),

          const SizedBox(height: 20),

          // Device info
          _buildDeviceCard(net),
        ],
      ),
    );
  }

  Widget _buildStatusCard(NetworkService net) {
    Color statusColor;
    String statusText;
    IconData statusIcon;

    if (net.isConnected) {
      switch (net.activeConnection) {
        case ConnectionType.lan:
          statusColor = const Color(0xFF22C55E);
          statusText = 'Connected via LAN WiFi';
          statusIcon = Icons.wifi;
          break;
        case ConnectionType.online:
          statusColor = const Color(0xFF6366F1);
          statusText = 'Connected Online';
          statusIcon = Icons.cloud_done;
          break;
        default:
          statusColor = const Color(0xFFF59E0B);
          statusText = 'Disconnected';
          statusIcon = Icons.cloud_off;
      }
    } else {
      statusColor = const Color(0xFFEF4444);
      statusText = 'Not Connected';
      statusIcon = Icons.signal_wifi_off;
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [statusColor.withValues(alpha: 0.15), statusColor.withValues(alpha: 0.05)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 50, height: 50,
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(statusIcon, color: statusColor, size: 26),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(statusText, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: statusColor)),
                const SizedBox(height: 4),
                Text(
                  net.isConnected ? ApiService.baseUrl : 'Configure a server below',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
                ),
              ],
            ),
          ),
          Container(
            width: 12, height: 12,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: statusColor,
              boxShadow: [BoxShadow(color: statusColor.withValues(alpha: 0.5), blurRadius: 8)],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModeSelector(NetworkService net) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('CONNECTION MODE',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF9CA3AF))),
            const SizedBox(height: 12),
            Row(
              children: [
                _modeChip('Auto', 'auto', Icons.auto_fix_high, net),
                const SizedBox(width: 8),
                _modeChip('LAN Only', 'lan', Icons.wifi, net),
                const SizedBox(width: 8),
                _modeChip('Online Only', 'online', Icons.cloud, net),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              net.connectionMode == 'auto'
                  ? 'Auto: Connects to LAN when on WiFi, falls back to online'
                  : net.connectionMode == 'lan'
                      ? 'Forces LAN connection only (WiFi required)'
                      : 'Forces online/cloud connection only',
              style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _modeChip(String label, String mode, IconData icon, NetworkService net) {
    final isActive = net.connectionMode == mode;
    return Expanded(
      child: GestureDetector(
        onTap: () => net.setConnectionMode(mode),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isActive ? const Color(0xFF6366F1).withValues(alpha: 0.15) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isActive ? const Color(0xFF6366F1) : const Color(0xFF2D2D3D),
            ),
          ),
          child: Column(
            children: [
              Icon(icon, size: 18, color: isActive ? const Color(0xFF6366F1) : const Color(0xFF9CA3AF)),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: isActive ? const Color(0xFF6366F1) : const Color(0xFF9CA3AF),
              )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildServerCard({
    required String label,
    required IconData icon,
    required Color iconColor,
    required String hint,
    required TextEditingController controller,
    required bool isTesting,
    required bool isActive,
    required VoidCallback onTest,
    VoidCallback? onScan,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 16, color: iconColor),
                const SizedBox(width: 8),
                Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF9CA3AF))),
                const Spacer(),
                if (isActive)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF22C55E).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text('ACTIVE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Color(0xFF22C55E))),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: InputDecoration(
                hintText: hint,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: isTesting
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.check_circle_outline, size: 16),
                    label: Text(isTesting ? 'Testing...' : 'Test & Save'),
                    onPressed: isTesting || controller.text.trim().isEmpty ? null : onTest,
                  ),
                ),
                if (onScan != null) ...[
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.radar, size: 16),
                    label: const Text('Scan'),
                    onPressed: onScan,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDeviceCard(NetworkService net) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('DEVICE INFO',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF9CA3AF))),
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.phone_android, size: 16, color: Color(0xFF9CA3AF)),
                const SizedBox(width: 10),
                Expanded(child: Text(net.deviceId ?? 'Unknown', style: const TextStyle(fontSize: 12, fontFamily: 'monospace'))),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.badge, size: 16, color: Color(0xFF9CA3AF)),
                const SizedBox(width: 10),
                const Text('Type: waiter_app', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
              ],
            ),
            if (net.isConnected) ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.app_registration, size: 16),
                  label: const Text('Register Device with Server'),
                  onPressed: () async {
                    final ok = await net.registerDevice();
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text(ok ? 'Device registered!' : 'Registration failed'),
                        backgroundColor: ok ? const Color(0xFF22C55E) : const Color(0xFFEF4444),
                      ));
                    }
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showScanDialog(NetworkService net) {
    showDialog(
      context: context,
      builder: (ctx) => _ScanDialog(net: net, onSelect: (url) {
        _lanController.text = url;
        Navigator.pop(ctx);
        _testAndSave(url, true);
      }),
    );
  }

  @override
  void dispose() {
    _lanController.dispose();
    _onlineController.dispose();
    super.dispose();
  }
}

class _ScanDialog extends StatefulWidget {
  final NetworkService net;
  final ValueChanged<String> onSelect;
  const _ScanDialog({required this.net, required this.onSelect});

  @override
  State<_ScanDialog> createState() => _ScanDialogState();
}

class _ScanDialogState extends State<_ScanDialog> {
  @override
  void initState() {
    super.initState();
    widget.net.scanLan();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Scanning Network...'),
      content: ListenableBuilder(
        listenable: widget.net,
        builder: (ctx, _) {
          if (widget.net.isScanning) {
            return const Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 16),
                Text('Searching for POS servers on your WiFi network...',
                    style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
              ],
            );
          }

          final servers = widget.net.discoveredServers;
          if (servers.isEmpty) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.search_off, size: 48, color: Color(0xFF6B7280)),
                const SizedBox(height: 12),
                Text(widget.net.lastError ?? 'No servers found',
                    style: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
              ],
            );
          }

          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Found ${servers.length} server(s):', style: const TextStyle(fontSize: 13)),
              const SizedBox(height: 12),
              ...servers.map((url) => ListTile(
                leading: const Icon(Icons.dns, color: Color(0xFF22C55E)),
                title: Text(url, style: const TextStyle(fontSize: 13, fontFamily: 'monospace')),
                trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                onTap: () => widget.onSelect(url),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              )),
            ],
          );
        },
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        if (!widget.net.isScanning)
          TextButton(
            onPressed: () => widget.net.scanLan(),
            child: const Text('Scan Again'),
          ),
      ],
    );
  }
}

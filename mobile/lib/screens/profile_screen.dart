import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/sync_service.dart';
import '../services/claude_service.dart';
import '../services/network_service.dart';
import 'connection_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _hasAiKey = ClaudeService.hasApiKey;

  void _showAiKeyDialog() {
    final keyController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Claude API Key'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Enter your Anthropic API key. It is stored locally on this device only.',
              style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: keyController,
              decoration: const InputDecoration(hintText: 'sk-ant-...', labelText: 'API Key', isDense: true),
              obscureText: true,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          if (_hasAiKey)
            TextButton(
              onPressed: () async {
                await ClaudeService.clearApiKey();
                setState(() => _hasAiKey = false);
                if (ctx.mounted) Navigator.pop(ctx);
              },
              child: const Text('Remove', style: TextStyle(color: Color(0xFFEF4444))),
            ),
          ElevatedButton(
            onPressed: () async {
              final key = keyController.text.trim();
              if (key.isNotEmpty) {
                await ClaudeService.setApiKey(key);
                setState(() => _hasAiKey = true);
                if (ctx.mounted) Navigator.pop(ctx);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final sync = context.watch<SyncService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Avatar
          Center(
            child: CircleAvatar(
              radius: 40,
              backgroundColor: const Color(0xFF6366F1),
              child: Text(
                (auth.name.isNotEmpty ? auth.name[0] : '?').toUpperCase(),
                style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w700),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Center(
            child: Text(auth.name,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: 4),
          Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF6366F1).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    auth.role.toUpperCase(),
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF6366F1)),
                  ),
                ),
                if (auth.offlineMode) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'OFFLINE',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFF59E0B)),
                    ),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 32),

          // Server info
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('SERVER CONNECTION',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF9CA3AF))),
                  const SizedBox(height: 10),
                  Consumer<NetworkService>(
                    builder: (ctx, net, _) {
                      return Column(
                        children: [
                          Row(
                            children: [
                              Icon(
                                net.isConnected
                                    ? (net.isLanMode ? Icons.wifi : Icons.cloud_done)
                                    : Icons.signal_wifi_off,
                                size: 18,
                                color: net.isConnected
                                    ? const Color(0xFF22C55E)
                                    : const Color(0xFFF59E0B),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  net.isConnected
                                      ? '${net.isLanMode ? "LAN" : "Online"} — ${ApiService.baseUrl}'
                                      : 'Not Connected',
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(Icons.swap_horiz, size: 14, color: Color(0xFF6B7280)),
                              const SizedBox(width: 10),
                              Text(
                                'Mode: ${net.connectionMode == "auto" ? "Auto-switch" : net.connectionMode.toUpperCase()}',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              icon: const Icon(Icons.settings_ethernet, size: 16),
                              label: const Text('Connection Settings'),
                              onPressed: () => Navigator.push(context,
                                  MaterialPageRoute(builder: (_) => const ConnectionScreen())),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),

          // Sync status card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('SYNC STATUS',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF9CA3AF))),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Icon(
                        sync.pendingCount == 0
                            ? Icons.check_circle_outline
                            : Icons.hourglass_bottom,
                        size: 18,
                        color: sync.pendingCount == 0
                            ? const Color(0xFF22C55E)
                            : const Color(0xFFF59E0B),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        sync.pendingCount == 0
                            ? 'All data synced'
                            : '${sync.pendingCount} pending operations',
                        style: const TextStyle(fontSize: 13),
                      ),
                    ],
                  ),
                  if (sync.isSyncing) ...[
                    const SizedBox(height: 8),
                    const Row(
                      children: [
                        SizedBox(
                          width: 14, height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: 10),
                        Text('Syncing...', style: TextStyle(fontSize: 13)),
                      ],
                    ),
                  ],
                  if (sync.lastSyncError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      sync.lastSyncError!,
                      style: const TextStyle(fontSize: 11, color: Color(0xFFEF4444)),
                    ),
                  ],
                  if (sync.pendingCount > 0 && sync.isOnline && !sync.isSyncing) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.sync, size: 16),
                        label: const Text('Sync Now'),
                        onPressed: () => sync.syncAll(),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),

          // AI Settings card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('AI ASSISTANT',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF9CA3AF))),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(Icons.auto_awesome, size: 18, color: Color(0xFF6366F1)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _hasAiKey ? 'Claude API key configured' : 'No API key set',
                          style: const TextStyle(fontSize: 13),
                        ),
                      ),
                      Container(
                        width: 8, height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _hasAiKey ? const Color(0xFF22C55E) : const Color(0xFF9CA3AF),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      icon: Icon(_hasAiKey ? Icons.edit : Icons.key, size: 16),
                      label: Text(_hasAiKey ? 'Change API Key' : 'Set API Key'),
                      onPressed: _showAiKeyDialog,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          // Logout
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.logout, color: Color(0xFFEF4444)),
              label: const Text('Logout', style: TextStyle(color: Color(0xFFEF4444))),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFFEF4444)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: () async {
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Logout'),
                    content: Text(sync.pendingCount > 0
                        ? 'You have ${sync.pendingCount} unsynced operations. They will be preserved and sync next time you login. Logout?'
                        : 'Are you sure you want to logout?'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Logout', style: TextStyle(color: Color(0xFFEF4444))),
                      ),
                    ],
                  ),
                );
                if (confirmed == true && context.mounted) {
                  await auth.logout();
                }
              },
            ),
          ),
          
          const SizedBox(height: 32),
          const Center(
            child: Text('POS Waiter App v1.0.0',
                style: TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
          ),
        ],
      ),
    );
  }
}

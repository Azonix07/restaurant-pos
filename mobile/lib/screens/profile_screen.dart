import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

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
            child: Container(
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
                  Row(
                    children: [
                      const Icon(Icons.dns_outlined, size: 18, color: Color(0xFF9CA3AF)),
                      const SizedBox(width: 10),
                      Text(ApiService.baseUrl,
                          style: const TextStyle(fontSize: 13)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        width: 8, height: 8,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFF22C55E),
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Text('Connected',
                          style: TextStyle(fontSize: 13, color: Color(0xFF22C55E))),
                    ],
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
                    content: const Text('Are you sure you want to logout?'),
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

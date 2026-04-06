import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/sync_service.dart';
import '../services/network_service.dart';
import '../providers/auth_provider.dart';
import '../providers/order_provider.dart';
import '../theme.dart';
import 'tables_screen.dart';
import 'orders_screen.dart';
import 'menu_screen.dart';
import 'profile_screen.dart';
import 'admin_dashboard_screen.dart';
import 'reports_screen.dart';
import 'monitoring_screen.dart';
import 'staff_screen.dart';
import 'inventory_screen.dart';
import 'ai_chat_fab.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  bool _isAdmin(String role) => role == 'admin' || role == 'manager';

  List<Widget> _getScreens(String role) {
    if (_isAdmin(role)) {
      return [
        const AdminDashboardScreen(),
        const TablesScreen(),
        const OrdersScreen(),
        const ReportsScreen(),
        _buildMoreScreen(),
      ];
    }
    // waiter, chef, cashier, etc.
    return const [
      TablesScreen(),
      MenuScreen(),
      OrdersScreen(),
      ProfileScreen(),
    ];
  }

  List<NavigationDestination> _getDestinations(String role) {
    if (_isAdmin(role)) {
      return const [
        NavigationDestination(
          icon: Icon(Icons.dashboard_outlined),
          selectedIcon: Icon(Icons.dashboard),
          label: 'Dashboard',
        ),
        NavigationDestination(
          icon: Icon(Icons.table_restaurant_outlined),
          selectedIcon: Icon(Icons.table_restaurant),
          label: 'Tables',
        ),
        NavigationDestination(
          icon: Icon(Icons.receipt_long_outlined),
          selectedIcon: Icon(Icons.receipt_long),
          label: 'Orders',
        ),
        NavigationDestination(
          icon: Icon(Icons.bar_chart_outlined),
          selectedIcon: Icon(Icons.bar_chart),
          label: 'Reports',
        ),
        NavigationDestination(
          icon: Icon(Icons.more_horiz_outlined),
          selectedIcon: Icon(Icons.more_horiz),
          label: 'More',
        ),
      ];
    }
    return const [
      NavigationDestination(
        icon: Icon(Icons.table_restaurant_outlined),
        selectedIcon: Icon(Icons.table_restaurant),
        label: 'Tables',
      ),
      NavigationDestination(
        icon: Icon(Icons.restaurant_menu_outlined),
        selectedIcon: Icon(Icons.restaurant_menu),
        label: 'Menu',
      ),
      NavigationDestination(
        icon: Icon(Icons.receipt_long_outlined),
        selectedIcon: Icon(Icons.receipt_long),
        label: 'Orders',
      ),
      NavigationDestination(
        icon: Icon(Icons.person_outline),
        selectedIcon: Icon(Icons.person),
        label: 'Profile',
      ),
    ];
  }

  Widget _buildMoreScreen() {
    final items = [
      _MoreItem(Icons.monitor_heart_outlined, 'Monitoring', const MonitoringScreen()),
      _MoreItem(Icons.people_outline, 'Staff', const StaffScreen()),
      _MoreItem(Icons.inventory_2_outlined, 'Inventory', const InventoryScreen()),
      _MoreItem(Icons.restaurant_menu_outlined, 'Menu', const MenuScreen()),
      _MoreItem(Icons.person_outline, 'Profile', const ProfileScreen()),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 6),
        itemBuilder: (ctx, i) {
          final item = items[i];
          return Material(
            color: AppTheme.surface,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () {
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => item.screen));
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        color: AppTheme.accent.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(item.icon, size: 20, color: AppTheme.accent),
                    ),
                    const SizedBox(width: 14),
                    Expanded(child: Text(item.label, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 15))),
                    const Icon(Icons.chevron_right, size: 20, color: AppTheme.textMuted),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sync = context.watch<SyncService>();
    context.watch<NetworkService>();
    final role = context.watch<AuthProvider>().role;
    final screens = _getScreens(role);
    final destinations = _getDestinations(role);

    // Clamp index if role changes
    if (_currentIndex >= screens.length) _currentIndex = 0;

    return Scaffold(
      body: Stack(
        children: [
          Column(
            children: [
              // Offline banner
              if (!sync.isOnline)
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.only(
                    left: 16, right: 16, bottom: 8,
                    top: MediaQuery.of(context).padding.top + 8,
                  ),
                  color: AppTheme.warningBg,
                  child: Row(
                    children: [
                      const Icon(Icons.cloud_off_outlined, size: 16, color: AppTheme.warning),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text(
                          'Offline — changes will sync when connected',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppTheme.warning),
                        ),
                      ),
                      if (sync.pendingCount > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.warning,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${sync.pendingCount}',
                            style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w700),
                          ),
                        ),
                    ],
                  ),
                )
              else if (sync.isSyncing)
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.only(
                    left: 16, right: 16, bottom: 6,
                    top: MediaQuery.of(context).padding.top + 6,
                  ),
                  color: AppTheme.accentBg,
                  child: const Row(
                    children: [
                      SizedBox(
                        width: 12, height: 12,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.accent),
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Syncing...',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.accent),
                      ),
                    ],
                  ),
                ),
              // Main content
              Expanded(child: screens[_currentIndex]),
            ],
          ),
          // AI Chat FAB
          const AIChatFab(),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppTheme.border, width: 1)),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (i) {
            setState(() => _currentIndex = i);
            // Fetch orders when orders tab is selected
            final ordersIndex = _isAdmin(role) ? 2 : 2;
            if (i == ordersIndex) {
              context.read<OrderProvider>().fetchActiveOrders();
            }
          },
          destinations: destinations,
        ),
      ),
    );
  }
}

class _MoreItem {
  final IconData icon;
  final String label;
  final Widget screen;
  const _MoreItem(this.icon, this.label, this.screen);
}

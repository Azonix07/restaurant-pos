import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/sync_service.dart';
import '../services/network_service.dart';
import '../providers/order_provider.dart';
import '../theme.dart';
import 'tables_screen.dart';
import 'orders_screen.dart';
import 'menu_screen.dart';
import 'profile_screen.dart';
import 'ai_chat_fab.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final _screens = const [
    TablesScreen(),
    MenuScreen(),
    OrdersScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final sync = context.watch<SyncService>();
    context.watch<NetworkService>();

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
              Expanded(child: _screens[_currentIndex]),
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
            if (i == 2) {
              context.read<OrderProvider>().fetchActiveOrders();
            }
          },
          destinations: const [
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
          ],
        ),
      ),
    );
  }
}

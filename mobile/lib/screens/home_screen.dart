import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/sync_service.dart';
import '../providers/order_provider.dart';
import 'tables_screen.dart';
import 'orders_screen.dart';
import 'menu_screen.dart';
import 'profile_screen.dart';
import 'ai_chat_screen.dart';

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
    AiChatScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final sync = context.watch<SyncService>();

    return Scaffold(
      body: Column(
        children: [
          // Offline / syncing banner
          if (!sync.isOnline)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
              child: SafeArea(
                bottom: false,
                child: Row(
                  children: [
                    const Icon(Icons.cloud_off, size: 16, color: Color(0xFFF59E0B)),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Offline — changes will sync when connected',
                        style: TextStyle(fontSize: 12, color: Color(0xFFF59E0B)),
                      ),
                    ),
                    if (sync.pendingCount > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF59E0B),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '${sync.pendingCount} pending',
                          style: const TextStyle(fontSize: 10, color: Colors.black, fontWeight: FontWeight.w700),
                        ),
                      ),
                  ],
                ),
              ),
            )
          else if (sync.isSyncing)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: const Color(0xFF6366F1).withValues(alpha: 0.15),
              child: SafeArea(
                bottom: false,
                child: const Row(
                  children: [
                    SizedBox(
                      width: 14, height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6366F1)),
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Syncing offline data...',
                      style: TextStyle(fontSize: 12, color: Color(0xFF6366F1)),
                    ),
                  ],
                ),
              ),
            ),
          // Main content
          Expanded(child: _screens[_currentIndex]),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) {
          setState(() => _currentIndex = i);
          // Refresh orders when switching to orders tab
          if (i == 2) {
            context.read<OrderProvider>().fetchActiveOrders();
          }
          // Refresh not needed for AI tab, it handles its own state
        },
        items: const [
          BottomNavigationBarItem(
              icon: Icon(Icons.table_restaurant), label: 'Tables'),
          BottomNavigationBarItem(
              icon: Icon(Icons.restaurant_menu), label: 'Menu'),
          BottomNavigationBarItem(
              icon: Icon(Icons.receipt_long), label: 'Orders'),
          BottomNavigationBarItem(
              icon: Icon(Icons.auto_awesome), label: 'AI'),
          BottomNavigationBarItem(
              icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}

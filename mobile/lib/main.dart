import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/order_provider.dart';
import 'services/sync_service.dart';
import 'services/network_service.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'services/claude_service.dart';
import 'theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ClaudeService.init();
  await NetworkService.instance.init();
  runApp(const POSWaiterApp());
}

class POSWaiterApp extends StatelessWidget {
  const POSWaiterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..init()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
        ChangeNotifierProvider.value(value: SyncService.instance..init()),
        ChangeNotifierProvider.value(value: NetworkService.instance),
      ],
      child: Consumer<AuthProvider>(
        builder: (ctx, auth, _) {
          return MaterialApp(
            title: 'POS Waiter',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.darkTheme,
            home: auth.loading
                ? const Scaffold(
                    body: Center(child: CircularProgressIndicator()),
                  )
                : auth.isLoggedIn
                    ? const HomeScreen()
                    : const LoginScreen(),
          );
        },
      ),
    );
  }
}



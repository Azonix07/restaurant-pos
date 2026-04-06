import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _serverController = TextEditingController();
  bool _loading = false;
  bool _showServerConfig = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _serverController.text =
        ApiService.baseUrl.replaceFirst('/api', '');
  }

  Future<void> _login() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      setState(() => _error = 'Please fill in all fields');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context
          .read<AuthProvider>()
          .login(_emailController.text.trim(), _passwordController.text);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _testConnection() async {
    setState(() => _loading = true);
    final url = _serverController.text.trim();
    final ok = await ApiService.testConnection(url);
    if (ok) {
      await ApiService.setServerUrl(url);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Connected successfully!'),
              backgroundColor: Color(0xFF22C55E)),
        );
        setState(() => _showServerConfig = false);
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Connection failed. Check IP and port.'),
              backgroundColor: Color(0xFFEF4444)),
        );
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('🍽️', style: TextStyle(fontSize: 56)),
                const SizedBox(height: 12),
                Text('POS Waiter',
                    style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 4),
                Text('Sign in to start taking orders',
                    style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 40),

                // Server config toggle
                TextButton.icon(
                  onPressed: () =>
                      setState(() => _showServerConfig = !_showServerConfig),
                  icon: const Icon(Icons.wifi, size: 18),
                  label: Text(_showServerConfig
                      ? 'Hide Server Config'
                      : 'Server: ${ApiService.baseUrl.replaceFirst("/api", "")}'),
                ),

                if (_showServerConfig) ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _serverController,
                    decoration: const InputDecoration(
                      labelText: 'Server URL',
                      hintText: 'http://192.168.1.100:5001',
                      prefixIcon: Icon(Icons.dns),
                    ),
                    keyboardType: TextInputType.url,
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _loading ? null : _testConnection,
                      child: const Text('Test Connection'),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                const SizedBox(height: 8),
                TextField(
                  controller: _emailController,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passwordController,
                  decoration: const InputDecoration(
                    labelText: 'Password',
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _login(),
                ),

                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline,
                            color: Color(0xFFEF4444), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(_error!,
                              style: const TextStyle(
                                  color: Color(0xFFEF4444), fontSize: 13)),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _login,
                    child: _loading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child:
                                CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Sign In'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _serverController.dispose();
    super.dispose();
  }
}

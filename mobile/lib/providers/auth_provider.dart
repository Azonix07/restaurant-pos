import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/offline_storage.dart';

class AuthProvider extends ChangeNotifier {
  Map<String, dynamic>? _user;
  bool _loading = true;
  bool _offlineMode = false;

  Map<String, dynamic>? get user => _user;
  bool get loading => _loading;
  bool get isLoggedIn => _user != null;
  bool get offlineMode => _offlineMode;
  String get role => _user?['role'] as String? ?? '';
  String get name => _user?['name'] as String? ?? '';

  bool hasRole(List<String> roles) => roles.contains(role);

  Future<void> init() async {
    await ApiService.init();
    if (ApiService.isAuthenticated) {
      try {
        // Try to validate token online
        final data = await ApiService.get('/auth/me');
        _user = data['user'] as Map<String, dynamic>?;
        _offlineMode = false;
        // Update cached user
        if (_user != null) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('cached_user', jsonEncode(_user));
        }
      } catch (_) {
        // Server unreachable — use cached user data
        final prefs = await SharedPreferences.getInstance();
        final cached = prefs.getString('cached_user');
        if (cached != null) {
          _user = Map<String, dynamic>.from(jsonDecode(cached));
          _offlineMode = true;
        }
      }
    } else {
      // No token stored — check if we have cached credentials for offline login
      // User will need to login via login screen
      _user = null;
    }
    _loading = false;
    notifyListeners();
  }

  /// Online login — connects to server, caches everything for future offline use
  Future<void> login(String email, String password) async {
    try {
      final data = await ApiService.post('/auth/login', {
        'email': email,
        'password': password,
      });
      final token = data['token'] as String;
      await ApiService.setToken(token);
      _user = data['user'] as Map<String, dynamic>?;
      _offlineMode = false;

      // Cache for offline: user profile + credentials
      final prefs = await SharedPreferences.getInstance();
      if (_user != null) {
        await prefs.setString('cached_user', jsonEncode(_user));
        await OfflineStorage.cacheCredentials(email, password, token, _user!);
      }
      notifyListeners();
    } catch (e) {
      // Server unreachable — try offline login
      final offlineResult = await _tryOfflineLogin(email, password);
      if (offlineResult) {
        notifyListeners();
        return;
      }
      rethrow; // No cached credentials either
    }
  }

  /// Offline login — verifies against cached credentials
  Future<bool> _tryOfflineLogin(String email, String password) async {
    final cached = await OfflineStorage.getCachedCredentials();
    if (cached == null) return false;

    if (OfflineStorage.verifyOfflineCredentials(cached, email, password)) {
      // Credentials match — restore cached session
      await ApiService.setToken(cached['token'] as String);
      _user = Map<String, dynamic>.from(cached['user']);
      _offlineMode = true;
      return true;
    }
    return false;
  }

  /// Called by SyncService when connectivity returns — re-validate token
  Future<void> revalidateOnline() async {
    if (!_offlineMode || !ApiService.isAuthenticated) return;
    try {
      final data = await ApiService.get('/auth/me');
      _user = data['user'] as Map<String, dynamic>?;
      _offlineMode = false;
      if (_user != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cached_user', jsonEncode(_user));
      }
      notifyListeners();
    } catch (_) {
      // Token expired while offline — stay in offline mode
      // User's cached data is still valid for local operations
    }
  }

  Future<void> logout() async {
    await ApiService.setToken(null);
    _user = null;
    _offlineMode = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('cached_user');
    // Keep cached credentials so they can login offline next time
    notifyListeners();
  }
}

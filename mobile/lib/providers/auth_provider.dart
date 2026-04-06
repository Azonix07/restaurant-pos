import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  Map<String, dynamic>? _user;
  bool _loading = true;

  Map<String, dynamic>? get user => _user;
  bool get loading => _loading;
  bool get isLoggedIn => _user != null && ApiService.isAuthenticated;
  String get role => _user?['role'] as String? ?? '';
  String get name => _user?['name'] as String? ?? '';

  bool hasRole(List<String> roles) => roles.contains(role);

  Future<void> init() async {
    await ApiService.init();
    if (ApiService.isAuthenticated) {
      try {
        final data = await ApiService.get('/auth/me');
        _user = data['user'] as Map<String, dynamic>?;
      } catch (_) {
        final prefs = await SharedPreferences.getInstance();
        final cached = prefs.getString('cached_user');
        if (cached != null) {
          _user = Map<String, dynamic>.from(jsonDecode(cached));
        }
      }
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final data = await ApiService.post('/auth/login', {
      'email': email,
      'password': password,
    });
    await ApiService.setToken(data['token'] as String);
    _user = data['user'] as Map<String, dynamic>?;
    final prefs = await SharedPreferences.getInstance();
    if (_user != null) {
      await prefs.setString('cached_user', jsonEncode(_user));
    }
    notifyListeners();
  }

  Future<void> logout() async {
    await ApiService.setToken(null);
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('cached_user');
    notifyListeners();
  }
}

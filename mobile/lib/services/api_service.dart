import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static String? _baseUrl;
  static String? _token;
  static const _timeout = Duration(seconds: 15);

  static String get baseUrl => _baseUrl ?? 'http://192.168.1.100:5001/api';

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString('server_url') ?? 'http://192.168.1.100:5001/api';
    _token = prefs.getString('auth_token');
  }

  static Future<void> setServerUrl(String url) async {
    _baseUrl = url.endsWith('/api') ? url : '$url/api';
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', _baseUrl!);
  }

  static Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token != null) {
      await prefs.setString('auth_token', token);
    } else {
      await prefs.remove('auth_token');
    }
  }

  static String? get token => _token;
  static bool get isAuthenticated => _token != null;

  static Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  static Future<Map<String, dynamic>> get(String path) async {
    final response = await http
        .get(Uri.parse('$baseUrl$path'), headers: _headers)
        .timeout(_timeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> post(String path,
      [Map<String, dynamic>? body]) async {
    final response = await http
        .post(Uri.parse('$baseUrl$path'),
            headers: _headers, body: body != null ? jsonEncode(body) : null)
        .timeout(_timeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> put(String path,
      Map<String, dynamic> body) async {
    final response = await http
        .put(Uri.parse('$baseUrl$path'),
            headers: _headers, body: jsonEncode(body))
        .timeout(_timeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> patch(String path,
      Map<String, dynamic> body) async {
    final response = await http
        .patch(Uri.parse('$baseUrl$path'),
            headers: _headers, body: jsonEncode(body))
        .timeout(_timeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> delete(String path) async {
    final response = await http
        .delete(Uri.parse('$baseUrl$path'), headers: _headers)
        .timeout(_timeout);
    return _handleResponse(response);
  }

  static Map<String, dynamic> _handleResponse(http.Response response) {
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }
    throw ApiException(
      statusCode: response.statusCode,
      message: body['message'] as String? ?? 'Request failed',
    );
  }

  static Future<bool> testConnection(String url) async {
    try {
      final testUrl = url.endsWith('/api') ? url : '$url/api';
      final response = await http
          .get(Uri.parse('$testUrl/menu'), headers: {'Content-Type': 'application/json'})
          .timeout(const Duration(seconds: 5));
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException({required this.statusCode, required this.message});

  @override
  String toString() => message;
}

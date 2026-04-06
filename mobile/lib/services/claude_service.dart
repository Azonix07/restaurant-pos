import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class ClaudeService {
  static const _apiKeyPref = 'claude_api_key';
  static const _apiUrl = 'https://api.anthropic.com/v1/messages';
  static String? _apiKey;

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _apiKey = prefs.getString(_apiKeyPref);
  }

  static bool get hasApiKey => _apiKey != null && _apiKey!.isNotEmpty;

  static Future<void> setApiKey(String key) async {
    _apiKey = key;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_apiKeyPref, key);
  }

  static Future<void> clearApiKey() async {
    _apiKey = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_apiKeyPref);
  }

  /// Fetch context data from backend for Claude to reason about
  static Future<Map<String, dynamic>> _gatherContext(String query) async {
    final context = <String, dynamic>{};
    final q = query.toLowerCase();

    try {
      // Always fetch daily summary for context
      try {
        context['dailySummary'] = await ApiService.get('/reports/daily');
      } catch (_) {}

      // Fetch specific data based on the query
      if (q.contains('order') || q.contains('sale') || q.contains('revenue') || q.contains('today')) {
        try {
          context['activeOrders'] = await ApiService.get('/orders/active');
        } catch (_) {}
        try {
          context['salesHistory'] = await ApiService.get('/orders/sales-history?limit=20');
        } catch (_) {}
      }

      if (q.contains('menu') || q.contains('item') || q.contains('dish') || q.contains('food') || q.contains('popular')) {
        try {
          context['menuItems'] = await ApiService.get('/menu');
        } catch (_) {}
        try {
          context['itemSales'] = await ApiService.get('/reports/items');
        } catch (_) {}
      }

      if (q.contains('table') || q.contains('seat') || q.contains('occupan')) {
        try {
          context['tables'] = await ApiService.get('/tables');
        } catch (_) {}
      }

      if (q.contains('staff') || q.contains('waiter') || q.contains('employee') || q.contains('perform')) {
        try {
          context['staffPerformance'] = await ApiService.get('/reports/staff-performance');
        } catch (_) {}
      }

      if (q.contains('tax') || q.contains('gst')) {
        try {
          context['taxReport'] = await ApiService.get('/reports/tax');
        } catch (_) {}
      }

      if (q.contains('peak') || q.contains('busy') || q.contains('rush')) {
        try {
          context['peakHours'] = await ApiService.get('/reports/peak-hours');
        } catch (_) {}
      }

      if (q.contains('profit') || q.contains('loss') || q.contains('expense')) {
        try {
          context['profitLoss'] = await ApiService.get('/reports/profit-loss');
        } catch (_) {}
      }

      if (q.contains('alert') || q.contains('fraud') || q.contains('monitor') || q.contains('issue')) {
        try {
          context['alerts'] = await ApiService.get('/monitoring/alerts');
        } catch (_) {}
        try {
          context['dashboard'] = await ApiService.get('/monitoring/dashboard');
        } catch (_) {}
      }

      if (q.contains('customer')) {
        try {
          context['customers'] = await ApiService.get('/customers?limit=20');
        } catch (_) {}
      }

      if (q.contains('inventory') || q.contains('stock')) {
        try {
          context['inventory'] = await ApiService.get('/inventory');
        } catch (_) {}
      }

      if (q.contains('expense') || q.contains('cost')) {
        try {
          context['expenses'] = await ApiService.get('/expenses?limit=20');
        } catch (_) {}
      }
    } catch (_) {}

    return context;
  }

  /// Send a message to Claude with restaurant context
  static Future<String> chat(String userMessage, List<Map<String, String>> history) async {
    if (_apiKey == null || _apiKey!.isEmpty) {
      throw Exception('Claude API key not set. Go to Profile > AI Settings to add your key.');
    }

    // Gather relevant data from the POS backend
    final context = await _gatherContext(userMessage);

    final systemPrompt = '''You are an AI assistant for a restaurant POS system. You help the admin/manager with:
- Analyzing sales data, revenue, and trends
- Menu performance and item popularity
- Staff performance tracking
- Table occupancy and management
- Expense tracking and profit/loss analysis
- Tax and GST reports
- Fraud alerts and monitoring
- Inventory and stock management
- Customer insights
- Actionable business recommendations

You have access to real-time data from the restaurant's backend system.
Format your responses clearly with bullet points and numbers where appropriate.
Use ₹ (INR) for currency. Keep responses concise and actionable.
If you don't have enough data to answer, say so clearly.

Current restaurant data context:
${jsonEncode(context)}''';

    final messages = <Map<String, String>>[];
    // Add conversation history (last 10 messages)
    final recentHistory = history.length > 10 ? history.sublist(history.length - 10) : history;
    for (final msg in recentHistory) {
      messages.add({'role': msg['role']!, 'content': msg['content']!});
    }
    messages.add({'role': 'user', 'content': userMessage});

    final response = await http.post(
      Uri.parse(_apiUrl),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: jsonEncode({
        'model': 'claude-sonnet-4-20250514',
        'max_tokens': 2048,
        'system': systemPrompt,
        'messages': messages,
      }),
    ).timeout(const Duration(seconds: 60));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final content = data['content'] as List?;
      if (content != null && content.isNotEmpty) {
        return content[0]['text'] as String;
      }
      return 'No response from Claude.';
    } else {
      final body = jsonDecode(response.body);
      final errorMsg = body['error']?['message'] ?? 'Unknown error';
      throw Exception('Claude API error: $errorMsg');
    }
  }
}

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'api_service.dart';

/// Manages automatic server discovery, LAN/online switching, and device registration.
class NetworkService extends ChangeNotifier {
  static final NetworkService instance = NetworkService._();
  NetworkService._();

  static const _lanUrlPref = 'lan_server_url';
  static const _onlineUrlPref = 'online_server_url';
  static const _deviceIdPref = 'pos_device_id';
  static const _connectionModePref = 'connection_mode'; // auto, lan, online

  String? _lanUrl;
  String? _onlineUrl;
  String? _deviceId;
  String _connectionMode = 'auto'; // auto, lan, online

  ConnectionType _activeConnection = ConnectionType.none;
  bool _isConnected = false;
  bool _isScanning = false;
  String? _lastError;
  List<String> _discoveredServers = [];

  StreamSubscription? _connectivitySub;
  Timer? _healthCheckTimer;

  // Getters
  String? get lanUrl => _lanUrl;
  String? get onlineUrl => _onlineUrl;
  String? get deviceId => _deviceId;
  String get connectionMode => _connectionMode;
  ConnectionType get activeConnection => _activeConnection;
  bool get isConnected => _isConnected;
  bool get isScanning => _isScanning;
  String? get lastError => _lastError;
  List<String> get discoveredServers => _discoveredServers;
  bool get isLanMode => _activeConnection == ConnectionType.lan;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _lanUrl = prefs.getString(_lanUrlPref);
    _onlineUrl = prefs.getString(_onlineUrlPref);
    _connectionMode = prefs.getString(_connectionModePref) ?? 'auto';
    _deviceId = prefs.getString(_deviceIdPref);

    if (_deviceId == null) {
      _deviceId = 'MOB-${DateTime.now().millisecondsSinceEpoch}-${Platform.localHostname.hashCode.abs().toString().substring(0, 4)}';
      await prefs.setString(_deviceIdPref, _deviceId!);
    }

    // Start monitoring
    _connectivitySub = Connectivity().onConnectivityChanged.listen(_onConnectivityChanged);
    _healthCheckTimer = Timer.periodic(const Duration(seconds: 30), (_) => _healthCheck());

    // Initial connection attempt
    await _resolveConnection();
    notifyListeners();
  }

  void _onConnectivityChanged(List<ConnectivityResult> results) {
    _resolveConnection();
  }

  Future<void> _resolveConnection() async {
    final results = await Connectivity().checkConnectivity();
    final hasWifi = results.contains(ConnectivityResult.wifi);
    final hasMobile = results.contains(ConnectivityResult.mobile);
    final hasEthernet = results.contains(ConnectivityResult.ethernet);

    if (!hasWifi && !hasMobile && !hasEthernet) {
      _activeConnection = ConnectionType.none;
      _isConnected = false;
      notifyListeners();
      return;
    }

    switch (_connectionMode) {
      case 'lan':
        await _tryLan();
        break;
      case 'online':
        await _tryOnline();
        break;
      default: // auto
        if (hasWifi || hasEthernet) {
          final lanOk = await _tryLan();
          if (!lanOk) await _tryOnline();
        } else {
          await _tryOnline();
        }
    }

    notifyListeners();
  }

  Future<bool> _tryLan() async {
    if (_lanUrl == null || _lanUrl!.isEmpty) return false;
    final ok = await _checkServer(_lanUrl!);
    if (ok) {
      _activeConnection = ConnectionType.lan;
      _isConnected = true;
      _lastError = null;
      await ApiService.setServerUrl(_lanUrl!);
      return true;
    }
    return false;
  }

  Future<bool> _tryOnline() async {
    if (_onlineUrl == null || _onlineUrl!.isEmpty) return false;
    final ok = await _checkServer(_onlineUrl!);
    if (ok) {
      _activeConnection = ConnectionType.online;
      _isConnected = true;
      _lastError = null;
      await ApiService.setServerUrl(_onlineUrl!);
      return true;
    }
    _isConnected = false;
    _activeConnection = ConnectionType.none;
    return false;
  }

  Future<bool> _checkServer(String url) async {
    try {
      final baseUrl = url.endsWith('/api') ? url : '$url/api';
      final response = await http
          .get(Uri.parse('$baseUrl/health'), headers: {'Content-Type': 'application/json'})
          .timeout(const Duration(seconds: 4));
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<void> _healthCheck() async {
    if (_connectionMode == 'auto') {
      await _resolveConnection();
    } else {
      final url = _connectionMode == 'lan' ? _lanUrl : _onlineUrl;
      if (url != null) {
        final ok = await _checkServer(url);
        final wasConnected = _isConnected;
        _isConnected = ok;
        if (wasConnected != ok) notifyListeners();
      }
    }
  }

  /// Scan local network for POS servers on common ports
  Future<List<String>> scanLan({int port = 5001}) async {
    _isScanning = true;
    _discoveredServers = [];
    notifyListeners();

    try {
      // Get current device IP to find the subnet
      final interfaces = await NetworkInterface.list(type: InternetAddressType.IPv4);
      final wifiAddresses = <String>[];

      for (final iface in interfaces) {
        for (final addr in iface.addresses) {
          if (!addr.address.startsWith('127.')) {
            wifiAddresses.add(addr.address);
          }
        }
      }

      if (wifiAddresses.isEmpty) {
        _lastError = 'No WiFi network detected';
        _isScanning = false;
        notifyListeners();
        return [];
      }

      final found = <String>[];

      for (final myIp in wifiAddresses) {
        final subnet = myIp.substring(0, myIp.lastIndexOf('.'));

        // Parallel scan: check all IPs in subnet
        final futures = <Future<String?>>[];
        for (int i = 1; i <= 254; i++) {
          final ip = '$subnet.$i';
          futures.add(_probeServer(ip, port));
        }

        final results = await Future.wait(futures);
        found.addAll(results.whereType<String>());
      }

      _discoveredServers = found;
      _lastError = found.isEmpty ? 'No POS servers found on network' : null;
    } catch (e) {
      _lastError = 'Scan failed: $e';
    }

    _isScanning = false;
    notifyListeners();
    return _discoveredServers;
  }

  Future<String?> _probeServer(String ip, int port) async {
    try {
      final url = 'http://$ip:$port/api/health';
      final response = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 2));
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['status'] == 'ok') {
          return 'http://$ip:$port';
        }
      }
    } catch (_) {}
    return null;
  }

  /// Register this device with the discovered server
  Future<bool> registerDevice() async {
    if (!_isConnected || _deviceId == null) return false;
    try {
      await ApiService.post('/devices/register', {
        'deviceId': _deviceId,
        'name': 'Waiter App (${Platform.localHostname})',
        'type': 'waiter_app',
        'ipAddress': await _getMyIp(),
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<String> _getMyIp() async {
    try {
      final interfaces = await NetworkInterface.list(type: InternetAddressType.IPv4);
      for (final iface in interfaces) {
        for (final addr in iface.addresses) {
          if (!addr.address.startsWith('127.')) return addr.address;
        }
      }
    } catch (_) {}
    return 'unknown';
  }

  // Setters
  Future<void> setLanUrl(String url) async {
    _lanUrl = url.endsWith('/api') ? url.replaceAll('/api', '') : url;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_lanUrlPref, _lanUrl!);
    await _resolveConnection();
  }

  Future<void> setOnlineUrl(String url) async {
    _onlineUrl = url.endsWith('/api') ? url.replaceAll('/api', '') : url;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_onlineUrlPref, _onlineUrl!);
    await _resolveConnection();
  }

  Future<void> setConnectionMode(String mode) async {
    _connectionMode = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_connectionModePref, mode);
    await _resolveConnection();
  }

  @override
  void dispose() {
    _connectivitySub?.cancel();
    _healthCheckTimer?.cancel();
    super.dispose();
  }
}

enum ConnectionType { none, lan, online }

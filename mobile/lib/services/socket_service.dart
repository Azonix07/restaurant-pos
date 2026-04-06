import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/io.dart';

class SocketService {
  static SocketService? _instance;
  WebSocketChannel? _channel;
  final _controller = StreamController<Map<String, dynamic>>.broadcast();
  Timer? _heartbeatTimer;
  Timer? _reconnectTimer;
  bool _isConnected = false;
  String? _serverUrl;

  static SocketService get instance {
    _instance ??= SocketService._();
    return _instance!;
  }

  SocketService._();

  Stream<Map<String, dynamic>> get stream => _controller.stream;
  bool get isConnected => _isConnected;

  void connect(String serverUrl) {
    _serverUrl = serverUrl;
    _doConnect();
  }

  void _doConnect() {
    if (_serverUrl == null) return;
    try {
      // Convert http:// to ws://
      final wsUrl = _serverUrl!
          .replaceFirst('http://', 'ws://')
          .replaceFirst('https://', 'wss://')
          .replaceFirst('/api', '');

      _channel = IOWebSocketChannel.connect(
        '$wsUrl/socket.io/?EIO=4&transport=websocket',
        pingInterval: const Duration(seconds: 25),
      );

      _channel!.stream.listen(
        (data) {
          _isConnected = true;
          _handleMessage(data.toString());
        },
        onError: (error) {
          _isConnected = false;
          _scheduleReconnect();
        },
        onDone: () {
          _isConnected = false;
          _scheduleReconnect();
        },
      );

      _startHeartbeat();
    } catch (e) {
      _isConnected = false;
      _scheduleReconnect();
    }
  }

  void _handleMessage(String raw) {
    // Socket.IO protocol: messages start with a number prefix
    // 0 = connect, 2 = event, 3 = ack, 40 = connect to namespace, 42 = event
    if (raw.startsWith('42')) {
      try {
        final jsonStr = raw.substring(2);
        final decoded = jsonDecode(jsonStr) as List;
        if (decoded.length >= 2) {
          _controller.add({
            'event': decoded[0] as String,
            'data': decoded[1],
          });
        }
      } catch (_) {}
    }
  }

  void emit(String event, Map<String, dynamic> data) {
    if (_channel != null && _isConnected) {
      final payload = '42${jsonEncode([event, data])}';
      _channel!.sink.add(payload);
    }
  }

  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 25), (_) {
      if (_channel != null && _isConnected) {
        _channel!.sink.add('2'); // Socket.IO ping
      }
    });
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      if (!_isConnected) _doConnect();
    });
  }

  Stream<Map<String, dynamic>> on(String event) {
    return stream.where((msg) => msg['event'] == event).map((msg) => msg['data'] as Map<String, dynamic>? ?? {});
  }

  void dispose() {
    _heartbeatTimer?.cancel();
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _isConnected = false;
  }
}

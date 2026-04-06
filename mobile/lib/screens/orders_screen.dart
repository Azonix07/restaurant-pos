import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/order_provider.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OrderProvider>().fetchActiveOrders();
    });
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'confirmed': return const Color(0xFF3B82F6);
      case 'preparing': return const Color(0xFFF59E0B);
      case 'ready': return const Color(0xFF22C55E);
      case 'served': return const Color(0xFF8B5CF6);
      case 'completed': return const Color(0xFF6B7280);
      case 'cancelled': return const Color(0xFFEF4444);
      default: return const Color(0xFF9CA3AF);
    }
  }

  @override
  Widget build(BuildContext context) {
    final orderProv = context.watch<OrderProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Active Orders'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => orderProv.fetchActiveOrders(),
          ),
        ],
      ),
      body: orderProv.loadingOrders
          ? const Center(child: CircularProgressIndicator())
          : orderProv.activeOrders.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.receipt_long_outlined, size: 64, color: Color(0xFF6B7280)),
                      SizedBox(height: 12),
                      Text('No active orders', style: TextStyle(color: Color(0xFF9CA3AF))),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => orderProv.fetchActiveOrders(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: orderProv.activeOrders.length,
                    itemBuilder: (ctx, i) {
                      final order = orderProv.activeOrders[i];
                      final items = List<Map<String, dynamic>>.from(order['items'] ?? []);
                      final status = order['status']?.toString() ?? 'unknown';
                      final orderNum = order['orderNumber']?.toString() ?? '—';
                      final tableNum = order['table']?['number']?.toString() ??
                          order['table']?['name']?.toString() ?? '';
                      final type = order['type']?.toString().replaceAll('_', ' ').toUpperCase() ?? '';
                      final total = (order['total'] as num?)?.toDouble() ?? 0;
                      final createdAt = order['createdAt'] != null
                          ? DateFormat('h:mm a').format(DateTime.parse(order['createdAt']).toLocal())
                          : '';

                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => _showOrderDetails(order),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text('#$orderNum',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700, fontSize: 16)),
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: _statusColor(status).withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        status.toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          color: _statusColor(status),
                                        ),
                                      ),
                                    ),
                                    const Spacer(),
                                    Text(createdAt,
                                        style: const TextStyle(
                                            fontSize: 12, color: Color(0xFF9CA3AF))),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    if (tableNum.isNotEmpty) ...[
                                      const Icon(Icons.table_restaurant,
                                          size: 14, color: Color(0xFF9CA3AF)),
                                      const SizedBox(width: 4),
                                      Text('Table $tableNum',
                                          style: const TextStyle(
                                              fontSize: 13, color: Color(0xFF9CA3AF))),
                                      const SizedBox(width: 12),
                                    ],
                                    Text(type,
                                        style: const TextStyle(
                                            fontSize: 12, color: Color(0xFF6366F1))),
                                    const Spacer(),
                                    Text('₹${total.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700, fontSize: 15)),
                                  ],
                                ),
                                const Divider(height: 16),
                                ...items.take(3).map((item) => Padding(
                                      padding: const EdgeInsets.only(bottom: 2),
                                      child: Text(
                                        '${item['quantity']}x ${item['name'] ?? item['menuItem']?['name'] ?? ''}',
                                        style: const TextStyle(
                                            fontSize: 13, color: Color(0xFFD1D5DB)),
                                      ),
                                    )),
                                if (items.length > 3)
                                  Text('+${items.length - 3} more items',
                                      style: const TextStyle(
                                          fontSize: 12, color: Color(0xFF6B7280))),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }

  void _showOrderDetails(Map<String, dynamic> order) {
    final items = List<Map<String, dynamic>>.from(order['items'] ?? []);
    final status = order['status']?.toString() ?? '';
    final orderNum = order['orderNumber']?.toString() ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        minChildSize: 0.4,
        expand: false,
        builder: (ctx, sc) => Container(
          padding: const EdgeInsets.all(16),
          child: ListView(
            controller: sc,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF6B7280),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Text('Order #$orderNum',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              const Text('ITEMS',
                  style: TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF9CA3AF))),
              const SizedBox(height: 8),
              ...items.map((item) {
                final name = item['name'] ?? item['menuItem']?['name'] ?? '';
                final qty = item['quantity'] ?? 1;
                final price = (item['price'] as num?)?.toDouble() ??
                    (item['menuItem']?['price'] as num?)?.toDouble() ?? 0;
                final itemStatus = item['status']?.toString() ?? '';
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Text('$qty×', style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(width: 8),
                      Expanded(child: Text(name.toString())),
                      if (itemStatus.isNotEmpty) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _statusColor(itemStatus).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(itemStatus,
                              style: TextStyle(fontSize: 10, color: _statusColor(itemStatus))),
                        ),
                        const SizedBox(width: 8),
                      ],
                      Text('₹${(price * qty).toStringAsFixed(0)}'),
                    ],
                  ),
                );
              }),
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  Text(
                    '₹${((order['total'] as num?)?.toDouble() ?? 0).toStringAsFixed(0)}',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              if (status == 'confirmed' || status == 'preparing' || status == 'ready')
                Row(
                  children: [
                    if (status == 'ready')
                      Expanded(
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.check_circle_outline),
                          label: const Text('Mark Served'),
                          onPressed: () async {
                            try {
                              await context
                                  .read<OrderProvider>()
                                  .updateOrderStatus(order['_id'], 'served');
                            } catch (_) {
                              if (ctx.mounted) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                  const SnackBar(
                                    content: Text('Queued offline — will sync when connected'),
                                    backgroundColor: Color(0xFFF59E0B),
                                  ),
                                );
                              }
                            }
                            if (ctx.mounted) Navigator.pop(ctx);
                          },
                        ),
                      ),
                    if (status != 'ready') ...[
                      Expanded(
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.cancel_outlined, color: Color(0xFFEF4444)),
                          label: const Text('Cancel',
                              style: TextStyle(color: Color(0xFFEF4444))),
                          onPressed: () async {
                            try {
                              await context
                                  .read<OrderProvider>()
                                  .updateOrderStatus(order['_id'], 'cancelled');
                            } catch (_) {
                              if (ctx.mounted) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                  const SnackBar(
                                    content: Text('Queued offline — will sync when connected'),
                                    backgroundColor: Color(0xFFF59E0B),
                                  ),
                                );
                              }
                            }
                            if (ctx.mounted) Navigator.pop(ctx);
                          },
                        ),
                      ),
                    ],
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/order_provider.dart';
import '../theme.dart';

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
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.receipt_long_outlined, size: 56, color: AppTheme.textMuted.withValues(alpha: 0.4)),
                      const SizedBox(height: 12),
                      const Text('No active orders', style: TextStyle(color: AppTheme.textMuted, fontSize: 15)),
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
                      final sc = AppTheme.statusColor(status);

                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => _showOrderDetails(order),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text('#$orderNum',
                                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: sc.withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        status.toUpperCase(),
                                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: sc),
                                      ),
                                    ),
                                    const Spacer(),
                                    Text(createdAt, style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    if (tableNum.isNotEmpty) ...[
                                      const Icon(Icons.table_restaurant, size: 14, color: AppTheme.textMuted),
                                      const SizedBox(width: 4),
                                      Text('Table $tableNum', style: const TextStyle(fontSize: 13, color: AppTheme.textMuted)),
                                      const SizedBox(width: 12),
                                    ],
                                    Text(type, style: const TextStyle(fontSize: 12, color: AppTheme.accent)),
                                    const Spacer(),
                                    Text('₹${total.toStringAsFixed(0)}',
                                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                                  ],
                                ),
                                const Divider(height: 16),
                                ...items.take(3).map((item) => Padding(
                                      padding: const EdgeInsets.only(bottom: 2),
                                      child: Text(
                                        '${item['quantity']}x ${item['name'] ?? item['menuItem']?['name'] ?? ''}',
                                        style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                                      ),
                                    )),
                                if (items.length > 3)
                                  Text('+${items.length - 3} more items',
                                      style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
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
                  decoration: BoxDecoration(color: AppTheme.border, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              Text('Order #$orderNum', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              Text('ITEMS', style: Theme.of(context).textTheme.labelSmall),
              const SizedBox(height: 8),
              ...items.map((item) {
                final name = item['name'] ?? item['menuItem']?['name'] ?? '';
                final qty = item['quantity'] ?? 1;
                final price = (item['price'] as num?)?.toDouble() ??
                    (item['menuItem']?['price'] as num?)?.toDouble() ?? 0;
                final itemStatus = item['status']?.toString() ?? '';
                final isc = AppTheme.statusColor(itemStatus);
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
                            color: isc.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(itemStatus, style: TextStyle(fontSize: 10, color: isc)),
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
                  const Text('Total', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  Text(
                    '₹${((order['total'] as num?)?.toDouble() ?? 0).toStringAsFixed(0)}',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: AppTheme.accent),
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
                              await context.read<OrderProvider>().updateOrderStatus(order['_id'], 'served');
                            } catch (_) {
                              if (ctx.mounted) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                  const SnackBar(content: Text('Queued offline — will sync when connected'), backgroundColor: AppTheme.warning),
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
                          icon: const Icon(Icons.cancel_outlined, color: AppTheme.danger),
                          label: const Text('Cancel', style: TextStyle(color: AppTheme.danger)),
                          onPressed: () async {
                            try {
                              await context.read<OrderProvider>().updateOrderStatus(order['_id'], 'cancelled');
                            } catch (_) {
                              if (ctx.mounted) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                  const SnackBar(content: Text('Queued offline — will sync when connected'), backgroundColor: AppTheme.warning),
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

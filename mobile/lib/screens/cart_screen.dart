import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/order_provider.dart';
import '../theme.dart';

class CartScreen extends StatefulWidget {
  final String? existingOrderId;
  const CartScreen({super.key, this.existingOrderId});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  bool _submitting = false;
  final _notesController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<OrderProvider>();
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.existingOrderId != null ? 'Add to Order' : 'Review Order'),
        actions: [
          if (cart.cartItems.isNotEmpty)
            TextButton(
              onPressed: () {
                cart.clearCart();
                Navigator.pop(context);
              },
              child: const Text('Clear', style: TextStyle(color: AppTheme.danger)),
            ),
        ],
      ),
      body: cart.cartItems.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.shopping_cart_outlined, size: 56, color: AppTheme.textMuted.withValues(alpha: 0.4)),
                  const SizedBox(height: 12),
                  const Text('Cart is empty', style: TextStyle(color: AppTheme.textMuted, fontSize: 15)),
                ],
              ),
            )
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Table info
                      if (cart.selectedTable != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppTheme.accentBg,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.table_restaurant, color: AppTheme.accent, size: 20),
                              const SizedBox(width: 10),
                              Text(
                                'Table ${cart.selectedTable!['number'] ?? cart.selectedTable!['name']}',
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: AppTheme.accent),
                              ),
                              const Spacer(),
                              TextButton(
                                onPressed: () => cart.setTable(null),
                                child: const Text('Change'),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Order type
                      if (widget.existingOrderId == null) ...[
                        Text('ORDER TYPE', style: Theme.of(context).textTheme.labelSmall),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          children: ['dine_in', 'takeaway', 'delivery'].map((t) {
                            final selected = cart.orderType == t;
                            return ChoiceChip(
                              label: Text(t.replaceAll('_', ' ').toUpperCase()),
                              selected: selected,
                              onSelected: (_) => cart.setOrderType(t),
                              selectedColor: AppTheme.accentBg,
                              labelStyle: TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w600,
                                color: selected ? AppTheme.accent : AppTheme.textSecondary,
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // Items header
                      Text('ITEMS', style: Theme.of(context).textTheme.labelSmall),
                      const SizedBox(height: 8),
                      ...List.generate(cart.cartItems.length, (i) {
                        final item = cart.cartItems[i];
                        final qty = item['quantity'] as int;
                        final price = (item['price'] as num).toDouble();
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppTheme.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppTheme.border),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 10, height: 10,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: item['isVeg'] == true ? AppTheme.success : AppTheme.danger,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(item['name'] as String,
                                        style: const TextStyle(fontWeight: FontWeight.w600)),
                                    Text('₹${price.toStringAsFixed(0)} each',
                                        style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                  ],
                                ),
                              ),
                              // Qty controls
                              Container(
                                decoration: BoxDecoration(
                                  color: AppTheme.surfaceAlt,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: AppTheme.border),
                                ),
                                child: Row(
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.remove, size: 16),
                                      onPressed: () => cart.updateQuantity(i, qty - 1),
                                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                      padding: EdgeInsets.zero,
                                    ),
                                    Text('$qty', style: const TextStyle(fontWeight: FontWeight.w700)),
                                    IconButton(
                                      icon: const Icon(Icons.add, size: 16),
                                      onPressed: () => cart.updateQuantity(i, qty + 1),
                                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                      padding: EdgeInsets.zero,
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              SizedBox(
                                width: 60,
                                child: Text(
                                  '₹${(price * qty).toStringAsFixed(0)}',
                                  style: const TextStyle(fontWeight: FontWeight.w700),
                                  textAlign: TextAlign.right,
                                ),
                              ),
                            ],
                          ),
                        );
                      }),

                      const SizedBox(height: 16),
                      if (widget.existingOrderId == null) ...[
                        TextField(
                          controller: _nameController,
                          decoration: const InputDecoration(labelText: 'Customer Name (optional)', isDense: true),
                          onChanged: (v) => cart.setCustomerInfo(v, _phoneController.text),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _phoneController,
                          decoration: const InputDecoration(labelText: 'Phone (optional)', isDense: true),
                          keyboardType: TextInputType.phone,
                          onChanged: (v) => cart.setCustomerInfo(_nameController.text, v),
                        ),
                        const SizedBox(height: 10),
                      ],
                      TextField(
                        controller: _notesController,
                        decoration: const InputDecoration(labelText: 'Notes (optional)', isDense: true),
                        onChanged: (v) => cart.setNotes(v),
                      ),
                    ],
                  ),
                ),

                // Bottom bar
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: const BoxDecoration(
                    color: AppTheme.surface,
                    border: Border(top: BorderSide(color: AppTheme.border)),
                  ),
                  child: SafeArea(
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('${cart.cartCount} items', style: const TextStyle(color: AppTheme.textSecondary)),
                            Text('₹${cart.cartTotal.toStringAsFixed(0)}',
                                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppTheme.accent)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton(
                            onPressed: _submitting ? null : _submit,
                            child: _submitting
                                ? const SizedBox(height: 20, width: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : Text(
                                    widget.existingOrderId != null ? 'Add Items to Order' : 'Place Order & Send KOT',
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    final cart = context.read<OrderProvider>();
    try {
      if (widget.existingOrderId != null) {
        await cart.addItemsToOrder(widget.existingOrderId!);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Items added! KOT sent to kitchen.'), backgroundColor: AppTheme.success),
          );
          Navigator.popUntil(context, (r) => r.isFirst);
        }
      } else {
        final data = await cart.submitOrder();
        final orderNum = data['order']?['orderNumber'] ?? '';
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Order #$orderNum placed! KOT sent.'), backgroundColor: AppTheme.success),
          );
          Navigator.popUntil(context, (r) => r.isFirst);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Order queued offline. Will sync when connected.'), backgroundColor: AppTheme.warning),
        );
        Navigator.popUntil(context, (r) => r.isFirst);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }
}

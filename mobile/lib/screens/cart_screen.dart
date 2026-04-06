import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/order_provider.dart';

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
        title: Text(widget.existingOrderId != null
            ? 'Add to Order'
            : 'Review Order'),
        actions: [
          if (cart.cartItems.isNotEmpty)
            TextButton(
              onPressed: () {
                cart.clearCart();
                Navigator.pop(context);
              },
              child: const Text('Clear', style: TextStyle(color: Color(0xFFEF4444))),
            ),
        ],
      ),
      body: cart.cartItems.isEmpty
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.shopping_cart_outlined, size: 64, color: Color(0xFF6B7280)),
                  SizedBox(height: 12),
                  Text('Cart is empty', style: TextStyle(color: Color(0xFF9CA3AF))),
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
                            color: const Color(0xFF6366F1).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.table_restaurant, color: Color(0xFF6366F1)),
                              const SizedBox(width: 10),
                              Text(
                                'Table ${cart.selectedTable!['number'] ?? cart.selectedTable!['name']}',
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                              ),
                              const Spacer(),
                              TextButton(
                                onPressed: () {
                                  cart.setTable(null);
                                },
                                child: const Text('Change'),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],

                      // Order type (only for new orders)
                      if (widget.existingOrderId == null) ...[
                        const Text('Order Type',
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF9CA3AF))),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          children: ['dine_in', 'takeaway', 'delivery'].map((t) {
                            final selected = cart.orderType == t;
                            return ChoiceChip(
                              label: Text(t.replaceAll('_', ' ').toUpperCase()),
                              selected: selected,
                              onSelected: (_) => cart.setOrderType(t),
                              selectedColor: const Color(0xFF6366F1).withValues(alpha: 0.2),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Cart Items
                      const Text('ITEMS',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Color(0xFF9CA3AF))),
                      const SizedBox(height: 8),
                      ...List.generate(cart.cartItems.length, (i) {
                        final item = cart.cartItems[i];
                        final qty = item['quantity'] as int;
                        final price = (item['price'] as num).toDouble();
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            child: Row(
                              children: [
                                // Veg indicator
                                Container(
                                  width: 10, height: 10,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: item['isVeg'] == true
                                        ? const Color(0xFF22C55E)
                                        : const Color(0xFFEF4444),
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
                                          style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                                    ],
                                  ),
                                ),
                                // Qty controls
                                Container(
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF252536),
                                    borderRadius: BorderRadius.circular(8),
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
                          ),
                        );
                      }),

                      const SizedBox(height: 16),
                      // Customer info (optional)
                      if (widget.existingOrderId == null) ...[
                        TextField(
                          controller: _nameController,
                          decoration: const InputDecoration(
                            labelText: 'Customer Name (optional)',
                            isDense: true,
                          ),
                          onChanged: (v) => cart.setCustomerInfo(v, _phoneController.text),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _phoneController,
                          decoration: const InputDecoration(
                            labelText: 'Phone (optional)',
                            isDense: true,
                          ),
                          keyboardType: TextInputType.phone,
                          onChanged: (v) => cart.setCustomerInfo(_nameController.text, v),
                        ),
                        const SizedBox(height: 10),
                      ],
                      TextField(
                        controller: _notesController,
                        decoration: const InputDecoration(
                          labelText: 'Notes (optional)',
                          isDense: true,
                        ),
                        onChanged: (v) => cart.setNotes(v),
                      ),
                    ],
                  ),
                ),

                // Bottom total + submit
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardTheme.color,
                    border: const Border(top: BorderSide(color: Color(0xFF2D2D3D))),
                  ),
                  child: SafeArea(
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('${cart.cartCount} items',
                                style: const TextStyle(color: Color(0xFF9CA3AF))),
                            Text('₹${cart.cartTotal.toStringAsFixed(2)}',
                                style: const TextStyle(
                                    fontSize: 22, fontWeight: FontWeight.w700)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _submitting ? null : _submit,
                            child: _submitting
                                ? const SizedBox(
                                    height: 20, width: 20,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: Colors.white))
                                : Text(widget.existingOrderId != null
                                    ? 'Add Items to Order'
                                    : 'Place Order & Send KOT'),
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
            const SnackBar(content: Text('Items added! KOT sent to kitchen.'),
                backgroundColor: Color(0xFF22C55E)),
          );
          Navigator.popUntil(context, (r) => r.isFirst);
        }
      } else {
        final data = await cart.submitOrder();
        final orderNum = data['order']?['orderNumber'] ?? '';
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text('Order #$orderNum placed! KOT sent.'),
                backgroundColor: const Color(0xFF22C55E)),
          );
          Navigator.popUntil(context, (r) => r.isFirst);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Order queued offline. Will sync when connected.'),
            backgroundColor: const Color(0xFFF59E0B),
          ),
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

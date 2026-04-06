import 'package:flutter/material.dart';

class AppTheme {
  static const _primary = Color(0xFF6366F1);
  static const _background = Color(0xFF0F0F17);
  static const _surface = Color(0xFF1E1E2E);
  static const _card = Color(0xFF252536);
  static const _border = Color(0xFF2D2D3D);
  static const _textPrimary = Color(0xFFE5E7EB);
  static const _textSecondary = Color(0xFF9CA3AF);
  static const _success = Color(0xFF22C55E);
  static const _warning = Color(0xFFF59E0B);
  static const _danger = Color(0xFFEF4444);

  static final darkTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: _background,
    colorScheme: const ColorScheme.dark(
      primary: _primary,
      surface: _surface,
      error: _danger,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: _surface,
      foregroundColor: _textPrimary,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    cardTheme: const CardThemeData(
      color: _card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        side: BorderSide(color: _border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: _surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _primary, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: const TextStyle(color: _textSecondary),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: _primary,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: _primary,
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: _surface,
      selectedItemColor: _primary,
      unselectedItemColor: _textSecondary,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: _surface,
      selectedColor: _primary.withValues(alpha: 0.2),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: _border),
      ),
      labelStyle: const TextStyle(fontSize: 13),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: _card,
      contentTextStyle: const TextStyle(color: _textPrimary),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      behavior: SnackBarBehavior.floating,
    ),
    dividerTheme: const DividerThemeData(color: _border, thickness: 1),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(color: _textPrimary, fontWeight: FontWeight.w700),
      headlineMedium: TextStyle(color: _textPrimary, fontWeight: FontWeight.w700),
      titleLarge: TextStyle(color: _textPrimary, fontWeight: FontWeight.w600),
      titleMedium: TextStyle(color: _textPrimary, fontWeight: FontWeight.w600),
      bodyLarge: TextStyle(color: _textPrimary),
      bodyMedium: TextStyle(color: _textPrimary),
      bodySmall: TextStyle(color: _textSecondary),
      labelLarge: TextStyle(color: _textPrimary, fontWeight: FontWeight.w600),
    ),
  );

  // Status colors
  static Color statusColor(String status) {
    switch (status) {
      case 'available': return _success;
      case 'occupied': return _danger;
      case 'reserved': return _warning;
      case 'cleaning': return _textSecondary;
      case 'placed': return _warning;
      case 'confirmed': return const Color(0xFF3B82F6);
      case 'preparing': return const Color(0xFFF97316);
      case 'ready': return _success;
      case 'served': return _primary;
      case 'completed': return _success;
      case 'cancelled': return _danger;
      default: return _textSecondary;
    }
  }
}

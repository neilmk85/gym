import 'package:intl/intl.dart';

final _currency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
final _date     = DateFormat('dd MMM yyyy');
final _dateTime = DateFormat('dd MMM, h:mm a');
final _time     = DateFormat('h:mm a');

String formatCurrency(num amount) => _currency.format(amount);

DateTime? _parse(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  try { return DateTime.parse(iso).toLocal(); } catch (_) { return null; }
}

String formatDate(String? iso)    { final d = _parse(iso); return d == null ? '—' : _date.format(d); }
String formatDateTime(String? iso){ final d = _parse(iso); return d == null ? '—' : _dateTime.format(d); }
String formatTime(String? iso)    { final d = _parse(iso); return d == null ? '—' : _time.format(d); }

String daysUntil(String? iso) {
  final d = _parse(iso);
  if (d == null) return '—';
  final diff = d.difference(DateTime.now()).inDays;
  if (diff < 0) return 'Expired';
  if (diff == 0) return 'Today';
  return '$diff days';
}

String initials(String name) {
  final parts = name.trim().split(' ');
  if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  if (parts[0].isNotEmpty) return parts[0][0].toUpperCase();
  return '?';
}

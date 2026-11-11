import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge(this.status, {super.key});
  final String status;

  static const _cfg = {
    'active':    (Color(0xFF16A34A), Color(0xFFDCFCE7), 'Active'),
    'expired':   (Color(0xFFDC2626), Color(0xFFFEE2E2), 'Expired'),
    'frozen':    (Color(0xFF2563EB), Color(0xFFDBEAFE), 'Frozen'),
    'cancelled': (Color(0xFF6B7280), Color(0xFFF3F4F6), 'Cancelled'),
    'pending':   (Color(0xFFD97706), Color(0xFFFEF3C7), 'Pending'),
    'scheduled': (Color(0xFF2563EB), Color(0xFFDBEAFE), 'Scheduled'),
    'completed': (Color(0xFF16A34A), Color(0xFFDCFCE7), 'Completed'),
    'no_show':   (Color(0xFF6B7280), Color(0xFFF3F4F6), 'No Show'),
  };

  @override
  Widget build(BuildContext context) {
    final c = _cfg[status];
    final fg = c?.$1 ?? AppColors.textSecondary;
    final bg = c?.$2 ?? AppColors.surface;
    final label = c?.$3 ?? status;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}

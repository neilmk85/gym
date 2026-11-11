import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.sub,
    this.icon,
    this.color,
    this.gradient,
  });

  final String label;
  final String value;
  final String? sub;
  final IconData? icon;
  final Color? color;
  final List<Color>? gradient;

  @override
  Widget build(BuildContext context) {
    final bg = gradient != null
        ? BoxDecoration(gradient: LinearGradient(colors: gradient!, begin: Alignment.topLeft, end: Alignment.bottomRight), borderRadius: BorderRadius.circular(16))
        : BoxDecoration(color: (color ?? AppColors.primary).withOpacity(0.08), borderRadius: BorderRadius.circular(16));

    final textColor = gradient != null ? Colors.white : (color ?? AppColors.primary);
    final subColor  = gradient != null ? Colors.white70 : AppColors.textSecondary;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: bg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null)
            Icon(icon, color: textColor, size: 22),
          if (icon != null) const SizedBox(height: 10),
          Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: textColor)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: textColor.withOpacity(0.85))),
          if (sub != null) ...[
            const SizedBox(height: 2),
            Text(sub!, style: TextStyle(fontSize: 11, color: subColor)),
          ],
        ],
      ),
    );
  }
}

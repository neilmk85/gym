import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import 'profile_repository.dart';

class MyAttendanceScreen extends ConsumerWidget {
  const MyAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile  = ref.watch(memberProfileProvider);
    final memberId = profile?.id ?? ref.watch(authUserProvider).valueOrNull?.id ?? 0;
    final async    = ref.watch(attendanceProvider(memberId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Attendance History'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => context.pop(),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error:   (_, __) => const Center(
            child: Text('Could not load attendance', style: TextStyle(color: AppColors.textMuted))),
        data: (records) {
          if (records.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.how_to_reg_outlined, color: AppColors.textMuted, size: 48),
                  const SizedBox(height: 12),
                  const Text('No attendance records yet',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 16)),
                ],
              ),
            );
          }

          // Group by month
          final grouped = <String, List<AttendanceRecord>>{};
          for (final r in records) {
            try {
              final dt = DateTime.parse(r.checkInTime);
              final key = DateFormat('MMMM y').format(dt);
              grouped.putIfAbsent(key, () => []).add(r);
            } catch (_) {
              grouped.putIfAbsent('Other', () => []).add(r);
            }
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
            children: grouped.entries.map((entry) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(entry.key,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                          color: AppColors.textMuted, letterSpacing: 0.5)),
                ),
                ...entry.value.map((r) => _AttendanceTile(record: r)),
              ],
            )).toList(),
          );
        },
      ),
    );
  }
}

class _AttendanceTile extends StatelessWidget {
  const _AttendanceTile({required this.record});
  final AttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    String checkIn  = '—';
    String checkOut = '—';
    String dayLabel = '';

    try {
      final dt = DateTime.parse(record.checkInTime);
      checkIn  = DateFormat('h:mm a').format(dt);
      dayLabel = DateFormat('EEE, MMM d').format(dt);
    } catch (_) {
      dayLabel = record.date;
    }

    if (record.checkOutTime != null) {
      try {
        final dt = DateTime.parse(record.checkOutTime!);
        checkOut = DateFormat('h:mm a').format(dt);
      } catch (_) {}
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.login, color: AppColors.primary, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(dayLabel,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
                const SizedBox(height: 2),
                Text('In $checkIn${checkOut != '—' ? '  ·  Out $checkOut' : ''}',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
          if (record.checkOutTime != null) ...[
            _DurationChip(checkIn: record.checkInTime, checkOut: record.checkOutTime!),
          ],
        ],
      ),
    );
  }
}

class _DurationChip extends StatelessWidget {
  const _DurationChip({required this.checkIn, required this.checkOut});
  final String checkIn;
  final String checkOut;

  @override
  Widget build(BuildContext context) {
    try {
      final dur = DateTime.parse(checkOut).difference(DateTime.parse(checkIn));
      final h = dur.inHours;
      final m = dur.inMinutes % 60;
      final label = h > 0 ? '${h}h ${m}m' : '${m}m';
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.primary.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label,
            style: const TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w600)),
      );
    } catch (_) {
      return const SizedBox.shrink();
    }
  }
}

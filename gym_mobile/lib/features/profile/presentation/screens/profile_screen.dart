import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import 'profile_repository.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState  = ref.watch(authUserProvider);
    final profile    = ref.watch(memberProfileProvider);
    final user       = authState.valueOrNull;
    final memberId   = profile?.id ?? user?.id ?? 0;
    final statsAsync = ref.watch(memberStatsProvider(memberId));

    final fullName   = user?.fullName ?? '';
    final memberCode = profile?.memberCode ?? '—';
    final planName   = profile?.planName ?? 'Standard Plan';
    final status     = profile?.status ?? 'active';
    final daysLeft   = profile?.daysLeft ?? 0;
    final startDate  = profile?.startDate;
    final endDate    = profile?.endDate;

    // Compute plan progress
    int totalDays = 30;
    int usedDays  = 0;
    if (startDate != null && endDate != null) {
      try {
        final s = DateTime.parse(startDate);
        final e = DateTime.parse(endDate);
        totalDays = e.difference(s).inDays;
        usedDays  = DateTime.now().difference(s).inDays.clamp(0, totalDays);
      } catch (_) {}
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── Header ──────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                child: const Text('Profile',
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              ),
            ),

            // ── Identity card ────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.divider),
                  ),
                  child: Row(
                    children: [
                      _Avatar(name: fullName),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(fullName.isEmpty ? 'Member' : fullName,
                                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                            const SizedBox(height: 4),
                            Text(memberCode,
                                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, letterSpacing: 1)),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                              decoration: BoxDecoration(
                                color: status.toLowerCase() == 'active'
                                    ? AppColors.success.withOpacity(0.12)
                                    : AppColors.error.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                status.toUpperCase(),
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: status.toLowerCase() == 'active'
                                      ? AppColors.success
                                      : AppColors.error,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ── Plan card ────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.divider),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(planName,
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                          Text('$daysLeft days left',
                              style: const TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: totalDays > 0 ? usedDays / totalDays : 0,
                          minHeight: 6,
                          backgroundColor: AppColors.divider,
                          valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          if (startDate != null)
                            Text(_fmtDate(startDate),
                                style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                          if (endDate != null)
                            Text(_fmtDate(endDate),
                                style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ── Stats row ────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
                child: statsAsync.when(
                  loading: () => _StatsRowSkeleton(),
                  error:   (_, __) => const SizedBox.shrink(),
                  data: (stats) => _StatsRow(stats: stats),
                ),
              ),
            ),

            // ── Attendance calendar ──────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
                child: const Text('Attendance',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
                child: statsAsync.when(
                  loading: () => const SizedBox(height: 120),
                  error:   (_, __) => const SizedBox.shrink(),
                  data: (stats) => _AttendanceCalendar(visitDates: stats.visitDates),
                ),
              ),
            ),

            // ── Menu items ───────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                child: const Text('Account',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.divider),
                  ),
                  child: Column(
                    children: [
                      _MenuItem(
                        icon: Icons.qr_code_2_rounded,
                        label: 'My QR Code',
                        onTap: () => context.push('/qr'),
                      ),
                      const Divider(color: AppColors.divider, height: 1, indent: 56),
                      _MenuItem(
                        icon: Icons.how_to_reg_outlined,
                        label: 'Attendance History',
                        onTap: () => context.push('/attendance'),
                      ),
                      const Divider(color: AppColors.divider, height: 1, indent: 56),
                      _MenuItem(
                        icon: Icons.receipt_long_outlined,
                        label: 'Payment History',
                        onTap: () => context.push('/payments'),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ── Logout ───────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 40),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.divider),
                  ),
                  child: _MenuItem(
                    icon: Icons.logout,
                    label: 'Sign Out',
                    color: AppColors.error,
                    onTap: () async {
                      await ref.read(authUserProvider.notifier).logout();
                    },
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _fmtDate(String d) {
    try { return DateFormat('MMM d, y').format(DateTime.parse(d)); }
    catch (_) { return d; }
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────
class _Avatar extends StatelessWidget {
  const _Avatar({required this.name});
  final String name;

  String get _initials {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    if (parts.isNotEmpty && parts[0].isNotEmpty) return parts[0][0].toUpperCase();
    return 'U';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 64, height: 64,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.gradientStart, AppColors.gradientEnd],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
      ),
      child: Center(
        child: Text(_initials,
            style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
      ),
    );
  }
}

// ── Stats row ─────────────────────────────────────────────────────────────────
class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.stats});
  final MemberStats stats;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        children: [
          Expanded(child: _StatCell(label: 'Total Visits', value: '${stats.totalVisits}')),
          Container(width: 1, height: 48, color: AppColors.divider),
          Expanded(child: _StatCell(label: 'This Month',   value: '${stats.thisMonthVisits}')),
          Container(width: 1, height: 48, color: AppColors.divider),
          Expanded(child: _StatCell(label: 'Streak',       value: '${stats.streak} days')),
        ],
      ),
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        children: [
          Text(value,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        ],
      ),
    );
  }
}

class _StatsRowSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 72,
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
      ),
    );
  }
}

// ── Attendance calendar ───────────────────────────────────────────────────────
class _AttendanceCalendar extends StatelessWidget {
  const _AttendanceCalendar({required this.visitDates});
  final Set<String> visitDates;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final firstDay = DateTime(now.year, now.month, 1);
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;
    final startWeekday = firstDay.weekday; // 1=Mon

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(DateFormat('MMMM y').format(now),
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
          const SizedBox(height: 12),

          // Day headers
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: ['M','T','W','T','F','S','S'].map((d) =>
              SizedBox(
                width: 32,
                child: Text(d, textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w500)),
              )
            ).toList(),
          ),
          const SizedBox(height: 8),

          // Calendar grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              childAspectRatio: 1,
            ),
            itemCount: (startWeekday - 1) + daysInMonth,
            itemBuilder: (context, index) {
              if (index < startWeekday - 1) return const SizedBox();
              final day = index - (startWeekday - 2);
              final dateStr = '${now.year}-${now.month.toString().padLeft(2,'0')}-${day.toString().padLeft(2,'0')}';
              final visited = visitDates.contains(dateStr);
              final isToday = day == now.day;

              return Container(
                margin: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  color: visited
                      ? AppColors.primary
                      : isToday
                          ? AppColors.primary.withOpacity(0.15)
                          : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                  border: isToday && !visited
                      ? Border.all(color: AppColors.primary.withOpacity(0.4))
                      : null,
                ),
                child: Center(
                  child: Text('$day',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: visited
                            ? Colors.black
                            : isToday
                                ? AppColors.primary
                                : AppColors.textSecondary,
                      )),
                ),
              );
            },
          ),

          const SizedBox(height: 8),
          Row(
            children: [
              Container(width: 10, height: 10,
                  decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(2))),
              const SizedBox(width: 6),
              const Text('Gym visit', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Menu item ─────────────────────────────────────────────────────────────────
class _MenuItem extends StatelessWidget {
  const _MenuItem({required this.icon, required this.label, required this.onTap, this.color});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textSecondary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: c.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: c, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(label,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: c)),
            ),
            if (color == null)
              const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 18),
          ],
        ),
      ),
    );
  }
}

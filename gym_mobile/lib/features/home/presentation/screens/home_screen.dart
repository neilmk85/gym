import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../home/data/home_repository.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState  = ref.watch(authUserProvider);
    final profile    = ref.watch(memberProfileProvider);
    final user       = authState.valueOrNull;
    final firstName  = user?.firstName ?? 'there';
    final memberId   = profile?.id ?? user?.id ?? 0;

    final bookingsAsync = ref.watch(upcomingBookingsProvider(memberId));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── Header ──────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_greeting(),
                              style: const TextStyle(fontSize: 15, color: AppColors.textSecondary)),
                          const SizedBox(height: 2),
                          Text(firstName,
                              style: const TextStyle(
                                fontSize: 32, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                        ],
                      ),
                    ),
                    _AvatarButton(name: user?.fullName ?? ''),
                  ],
                ),
              ),
            ),

            // ── Membership Card ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                child: _MembershipCard(profile: profile),
              ),
            ),

            // ── Upcoming bookings ───────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Upcoming Classes',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    GestureDetector(
                      onTap: () => context.go('/classes'),
                      child: const Text('See all',
                          style: TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w500)),
                    ),
                  ],
                ),
              ),
            ),

            bookingsAsync.when(
              loading: () => const SliverToBoxAdapter(child: _ShimmerList()),
              error: (_, __) => const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 24),
                  child: _EmptyClasses(),
                ),
              ),
              data: (bookings) {
                if (bookings.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 24),
                      child: _EmptyClasses(),
                    ),
                  );
                }
                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, i) => Padding(
                      padding: const EdgeInsets.fromLTRB(24, 0, 24, 10),
                      child: _BookingCard(booking: bookings[i]),
                    ),
                    childCount: bookings.length,
                  ),
                );
              },
            ),

            // ── This Week strip ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('This Week',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    GestureDetector(
                      onTap: () => context.go('/classes'),
                      child: const Text('Book a class',
                          style: TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w500)),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
                child: bookingsAsync.when(
                  loading: () => const SizedBox.shrink(),
                  error:   (_, __) => const SizedBox.shrink(),
                  data:    (bookings) => _WeekStrip(bookings: bookings),
                ),
              ),
            ),

            // ── Quick actions ───────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                child: const Text('Quick Actions',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 40),
                child: Row(
                  children: [
                    Expanded(child: _QuickAction(
                      icon: Icons.qr_code_2_rounded,
                      label: 'My QR Code',
                      onTap: () => context.push('/qr'),
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: _QuickAction(
                      icon: Icons.calendar_month_outlined,
                      label: 'Book Class',
                      onTap: () => context.go('/classes'),
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: _QuickAction(
                      icon: Icons.fitness_center_outlined,
                      label: 'My Plan',
                      onTap: () => context.go('/workouts'),
                    )),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Avatar button ─────────────────────────────────────────────────────────────
class _AvatarButton extends StatelessWidget {
  const _AvatarButton({required this.name});
  final String name;

  String get _initials {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    if (parts.isNotEmpty && parts[0].isNotEmpty) return parts[0][0].toUpperCase();
    return 'U';
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/profile'),
      child: Container(
        width: 42, height: 42,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppColors.gradientStart, AppColors.gradientEnd],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(21),
        ),
        child: Center(
          child: Text(_initials,
              style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
        ),
      ),
    );
  }
}

// ── Membership card ───────────────────────────────────────────────────────────
class _MembershipCard extends StatelessWidget {
  const _MembershipCard({required this.profile});
  final dynamic profile;

  @override
  Widget build(BuildContext context) {
    final planName  = profile?.planName  ?? 'Standard Plan';
    final daysLeft  = profile?.daysLeft  ?? 0;
    final status    = profile?.status    ?? 'active';
    final memberCode = profile?.memberCode ?? '—';
    final endDate   = profile?.endDate;

    String expiry = '';
    if (endDate != null) {
      try {
        final dt = DateTime.parse(endDate);
        expiry = 'Expires ${DateFormat('MMM d, y').format(dt)}';
      } catch (_) {}
    }

    final isActive = status.toLowerCase() == 'active';
    final isExpiring = daysLeft <= 7 && daysLeft >= 0;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isExpiring
              ? [const Color(0xFF7C3AED), const Color(0xFF4F46E5)]
              : [AppColors.gradientStart, AppColors.gradientEnd],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(planName,
                  style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isActive
                      ? Colors.white.withOpacity(0.2)
                      : Colors.red.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  isActive ? 'Active' : status.toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            daysLeft > 0 ? '$daysLeft days left' : 'Expired',
            style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w800),
          ),
          if (expiry.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(expiry, style: const TextStyle(color: Colors.white60, fontSize: 12)),
          ],
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(memberCode,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.5,
                      fontFamily: 'monospace')),
              GestureDetector(
                onTap: () => context.push('/qr'),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.qr_code_2_rounded, color: Colors.white, size: 20),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Empty classes state ───────────────────────────────────────────────────────
class _EmptyClasses extends StatelessWidget {
  const _EmptyClasses();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        children: [
          const Icon(Icons.calendar_today_outlined, color: AppColors.textMuted, size: 32),
          const SizedBox(height: 12),
          const Text('No upcoming classes',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 15, fontWeight: FontWeight.w500)),
          const SizedBox(height: 4),
          const Text('Browse and book your next class',
              style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: () => context.go('/classes'),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.primary),
              foregroundColor: AppColors.primary,
              minimumSize: const Size(140, 40),
            ),
            child: const Text('Browse Classes'),
          ),
        ],
      ),
    );
  }
}

// ── Booking card ──────────────────────────────────────────────────────────────
class _BookingCard extends StatelessWidget {
  const _BookingCard({required this.booking});
  final UpcomingBooking booking;

  @override
  Widget build(BuildContext context) {
    String timeLabel = booking.startTime;
    try {
      final dt = DateFormat('HH:mm:ss').parse(booking.startTime);
      timeLabel = DateFormat('h:mm a').format(dt);
    } catch (_) {}

    String dateLabel = booking.classDate;
    try {
      final dt = DateTime.parse(booking.classDate);
      final today = DateTime.now();
      final isToday = dt.year == today.year && dt.month == today.month && dt.day == today.day;
      final isTomorrow = dt.difference(DateTime(today.year, today.month, today.day)).inDays == 1;
      if (isToday) dateLabel = 'Today';
      else if (isTomorrow) dateLabel = 'Tomorrow';
      else dateLabel = DateFormat('EEE, MMM d').format(dt);
    } catch (_) {}

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border(left: BorderSide(color: AppColors.primary, width: 3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(booking.className,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(booking.trainerName,
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(timeLabel,
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(dateLabel,
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Week strip ────────────────────────────────────────────────────────────────
class _WeekStrip extends StatelessWidget {
  const _WeekStrip({required this.bookings});
  final List<UpcomingBooking> bookings;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final monday = today.subtract(Duration(days: today.weekday - 1));
    final bookedDates = bookings.map((b) => b.classDate).toSet();

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(7, (i) {
        final day = monday.add(Duration(days: i));
        final dateStr = '${day.year}-${day.month.toString().padLeft(2,'0')}-${day.day.toString().padLeft(2,'0')}';
        final isToday = day.day == today.day && day.month == today.month;
        final hasClass = bookedDates.contains(dateStr);
        final dayName = ['M','T','W','T','F','S','S'][i];

        return Column(
          children: [
            Text(dayName,
                style: TextStyle(
                    fontSize: 11,
                    color: isToday ? AppColors.primary : AppColors.textMuted,
                    fontWeight: isToday ? FontWeight.w700 : FontWeight.w400)),
            const SizedBox(height: 6),
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: isToday ? AppColors.primary : AppColors.card,
                borderRadius: BorderRadius.circular(8),
                border: isToday ? null : Border.all(color: AppColors.divider),
              ),
              child: Center(
                child: Text('${day.day}',
                    style: TextStyle(
                        fontSize: 12,
                        color: isToday ? Colors.black : AppColors.textSecondary,
                        fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(height: 4),
            Container(
              width: 5, height: 5,
              decoration: BoxDecoration(
                color: hasClass ? AppColors.primary : Colors.transparent,
                shape: BoxShape.circle,
              ),
            ),
          ],
        );
      }),
    );
  }
}

// ── Quick action tile ─────────────────────────────────────────────────────────
class _QuickAction extends StatelessWidget {
  const _QuickAction({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.divider),
        ),
        child: Column(
          children: [
            Icon(icon, color: AppColors.primary, size: 24),
            const SizedBox(height: 8),
            Text(label,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}

// ── Shimmer placeholder ───────────────────────────────────────────────────────
class _ShimmerList extends StatelessWidget {
  const _ShimmerList();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: List.generate(3, (i) => Container(
          margin: const EdgeInsets.only(bottom: 10),
          height: 72,
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
          ),
        )),
      ),
    );
  }
}

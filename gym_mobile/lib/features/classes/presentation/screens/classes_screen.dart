import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/classes_repository.dart';

class ClassesScreen extends ConsumerStatefulWidget {
  const ClassesScreen({super.key});
  @override
  ConsumerState<ClassesScreen> createState() => _ClassesScreenState();
}

class _ClassesScreenState extends ConsumerState<ClassesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late DateTime _selectedDay;
  late List<DateTime> _weekDays;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _selectedDay = DateTime.now();
    _buildWeek();
  }

  void _buildWeek() {
    final today = DateTime.now();
    _weekDays = List.generate(14, (i) => today.add(Duration(days: i)));
  }

  String get _selectedDateStr =>
      DateFormat('yyyy-MM-dd').format(_selectedDay);

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profile  = ref.watch(memberProfileProvider);
    final memberId = profile?.id ?? ref.watch(authUserProvider).valueOrNull?.id ?? 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Title ────────────────────────────────────────────────
            const Padding(
              padding: EdgeInsets.fromLTRB(24, 24, 24, 0),
              child: Text('Classes',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            ),

            // ── Day strip ─────────────────────────────────────────────
            const SizedBox(height: 20),
            SizedBox(
              height: 72,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: _weekDays.length,
                itemBuilder: (context, i) {
                  final day = _weekDays[i];
                  final isSelected = DateFormat('yyyy-MM-dd').format(day) == _selectedDateStr;
                  final today = DateTime.now();
                  final isToday = day.year == today.year &&
                      day.month == today.month &&
                      day.day == today.day;

                  return GestureDetector(
                    onTap: () => setState(() => _selectedDay = day),
                    child: Container(
                      width: 52,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.primary : AppColors.card,
                        borderRadius: BorderRadius.circular(14),
                        border: isSelected
                            ? null
                            : Border.all(color: AppColors.divider),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            DateFormat('EEE').format(day).toUpperCase(),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: isSelected
                                  ? Colors.black
                                  : isToday
                                      ? AppColors.primary
                                      : AppColors.textMuted,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${day.day}',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: isSelected
                                  ? Colors.black
                                  : AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

            // ── Tabs ──────────────────────────────────────────────────
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Container(
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicatorSize: TabBarIndicatorSize.tab,
                  indicator: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  dividerColor: Colors.transparent,
                  labelColor: Colors.black,
                  unselectedLabelColor: AppColors.textMuted,
                  labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  tabs: const [
                    Tab(text: 'All Classes'),
                    Tab(text: 'My Bookings'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),

            // ── Content ───────────────────────────────────────────────
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _AllClassesTab(
                    dateStr:  _selectedDateStr,
                    memberId: memberId,
                  ),
                  _MyBookingsTab(memberId: memberId),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── All Classes tab ───────────────────────────────────────────────────────────
class _AllClassesTab extends ConsumerWidget {
  const _AllClassesTab({required this.dateStr, required this.memberId});
  final String dateStr;
  final int memberId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final classesAsync  = ref.watch(classesProvider(dateStr));
    final bookingsAsync = ref.watch(myBookingsProvider(memberId));

    return classesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error:   (_, __) => const Center(
          child: Text('Could not load classes', style: TextStyle(color: AppColors.textMuted))),
      data: (classes) {
        final myBookings = bookingsAsync.valueOrNull ?? [];
        final bookedMap  = {for (final b in myBookings) b.classId: b.id};

        // Merge booking status into classes
        for (final c in classes) {
          c.myBookingId = bookedMap[c.id];
        }

        if (classes.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.event_busy, color: AppColors.textMuted, size: 48),
                const SizedBox(height: 12),
                Text('No classes on ${DateFormat('EEEE').format(DateTime.parse(dateStr))}',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 15)),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          itemCount: classes.length,
          itemBuilder: (context, i) => _ClassTile(
            gymClass: classes[i],
            onBook: () async {
              final repo = ref.read(classesRepoProvider);
              final id   = await repo.bookClass(classes[i].id);
              if (id != null) {
                ref.invalidate(classesProvider(dateStr));
                ref.invalidate(myBookingsProvider(memberId));
              } else if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Could not book class. Please try again.')));
              }
            },
            onCancel: () async {
              final bookingId = classes[i].myBookingId;
              if (bookingId == null) return;
              final ok = await ref.read(classesRepoProvider).cancelBooking(bookingId);
              if (ok) { // ignore: curly_braces_in_flow_control_structures
                ref.invalidate(classesProvider(dateStr));
                ref.invalidate(myBookingsProvider(memberId));
              }
            },
          ),
        );
      },
    );
  }
}

// ── My Bookings tab ───────────────────────────────────────────────────────────
class _MyBookingsTab extends ConsumerWidget {
  const _MyBookingsTab({required this.memberId});
  final int memberId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final repoAsync = ref.watch(FutureProvider.autoDispose((r) =>
        r.read(classesRepoProvider).getMyBookings(memberId, fromDate: today)));

    return repoAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error:   (_, __) => const Center(
          child: Text('Could not load bookings', style: TextStyle(color: AppColors.textMuted))),
      data: (bookings) {
        if (bookings.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.bookmark_border, color: AppColors.textMuted, size: 48),
                const SizedBox(height: 12),
                const Text('No upcoming bookings',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 15)),
                const SizedBox(height: 4),
                const Text('Book a class from the All Classes tab',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
              ],
            ),
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          itemCount: bookings.length,
          itemBuilder: (context, i) => _BookingTile(booking: bookings[i]),
        );
      },
    );
  }
}

// ── Class tile ────────────────────────────────────────────────────────────────
class _ClassTile extends StatefulWidget {
  const _ClassTile({required this.gymClass, required this.onBook, required this.onCancel});
  final GymClass gymClass;
  final Future<void> Function() onBook;
  final Future<void> Function() onCancel;

  @override
  State<_ClassTile> createState() => _ClassTileState();
}

class _ClassTileState extends State<_ClassTile> {
  bool _loading = false;

  String _fmtTime(String t) {
    try { return DateFormat('h:mm a').format(DateFormat('HH:mm:ss').parse(t)); }
    catch (_) { return t; }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.gymClass;
    final isBooked = c.isBooked;
    final isFull   = c.isFull && !isBooked;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isBooked ? AppColors.primary.withOpacity(0.4) : AppColors.divider,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Time column
          SizedBox(
            width: 56,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_fmtTime(c.startTime),
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                Text('${c.durationMinutes}m',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ],
            ),
          ),
          const SizedBox(width: 12),

          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(c.category,
                          style: const TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(c.name,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(c.trainerName,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                const SizedBox(height: 2),
                Text('${c.bookedCount}/${c.capacity} spots',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ],
            ),
          ),

          // Book button
          _loading
              ? const SizedBox(width: 24, height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
              : GestureDetector(
                  onTap: isFull ? null : () async {
                    setState(() => _loading = true);
                    if (isBooked) await widget.onCancel();
                    else          await widget.onBook();
                    if (mounted) setState(() => _loading = false);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: isBooked
                          ? AppColors.primary.withOpacity(0.12)
                          : isFull
                              ? AppColors.card
                              : AppColors.primary,
                      borderRadius: BorderRadius.circular(20),
                      border: isBooked
                          ? Border.all(color: AppColors.primary)
                          : null,
                    ),
                    child: Text(
                      isBooked ? '✓ Booked' : isFull ? 'Full' : 'Book',
                      style: TextStyle(
                        color: isBooked
                            ? AppColors.primary
                            : isFull
                                ? AppColors.textMuted
                                : Colors.black,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
        ],
      ),
    );
  }
}

// ── Booking tile (My Bookings tab) ────────────────────────────────────────────
class _BookingTile extends StatelessWidget {
  const _BookingTile({required this.booking});
  final MemberBooking booking;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border(left: BorderSide(color: AppColors.primary, width: 3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle, color: AppColors.primary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text('Booking #${booking.id}',
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w500)),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.success.withOpacity(0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(booking.status.toUpperCase(),
                style: const TextStyle(color: AppColors.success, fontSize: 10, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}

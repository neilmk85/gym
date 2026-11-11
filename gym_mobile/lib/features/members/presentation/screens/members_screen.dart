import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../data/members_repository.dart';

// ── Providers ─────────────────────────────────────────────────────────────────

final _searchProvider = StateProvider<String>((_) => '');
final _statusFilterProvider = StateProvider<String>((_) => 'all');

final membersListProvider = FutureProvider.autoDispose
    .family<({List<Member> members, int total}), String>((ref, search) {
  final status = ref.watch(_statusFilterProvider);
  return ref.read(membersRepoProvider).list(search: search, status: status);
});

// ── Date preset enum ──────────────────────────────────────────────────────────

enum _Preset {
  today('Today', Icons.today_outlined),
  tomorrow('Tomorrow', Icons.event_outlined),
  thisWeek('This Week', Icons.view_week_outlined),
  thisMonth('This Month', Icons.calendar_month_outlined),
  nextMonth('Next Month', Icons.arrow_forward_outlined),
  quarter('Quarter', Icons.date_range_outlined),
  custom('Custom', Icons.tune);

  const _Preset(this.label, this.icon);
  final String label;
  final IconData icon;
}

({int queryDays, int minDay, int maxDay, String rangeLabel}) _rangeFor(
    _Preset preset, DateTimeRange? custom) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);

  switch (preset) {
    case _Preset.today:
      return (queryDays: 1, minDay: 0, maxDay: 0, rangeLabel: 'Expiring today');
    case _Preset.tomorrow:
      return (queryDays: 2, minDay: 1, maxDay: 1, rangeLabel: 'Expiring tomorrow');
    case _Preset.thisWeek:
      return (queryDays: 7, minDay: 0, maxDay: 7, rangeLabel: 'Expiring within 7 days');
    case _Preset.thisMonth:
      final endOfMonth = DateTime(now.year, now.month + 1, 0);
      final days = endOfMonth.difference(today).inDays;
      return (queryDays: days.clamp(1, 365), minDay: 0, maxDay: days, rangeLabel: 'Expiring this month');
    case _Preset.nextMonth:
      final startNext = DateTime(now.year, now.month + 1, 1);
      final endNext   = DateTime(now.year, now.month + 2, 0);
      final s = startNext.difference(today).inDays;
      final e = endNext.difference(today).inDays;
      return (queryDays: e, minDay: s, maxDay: e, rangeLabel: 'Expiring next month');
    case _Preset.quarter:
      return (queryDays: 90, minDay: 0, maxDay: 90, rangeLabel: 'Expiring in next 3 months');
    case _Preset.custom:
      if (custom == null) return (queryDays: 30, minDay: 0, maxDay: 30, rangeLabel: 'Pick a date range');
      final cs = DateTime(custom.start.year, custom.start.month, custom.start.day);
      final ce = DateTime(custom.end.year, custom.end.month, custom.end.day);
      final s  = cs.difference(today).inDays;
      final e  = ce.difference(today).inDays;
      final label = '${formatDate(custom.start.toIso8601String())} – ${formatDate(custom.end.toIso8601String())}';
      return (queryDays: max(e, 1), minDay: s, maxDay: e, rangeLabel: label);
  }
}

// ── Main screen ───────────────────────────────────────────────────────────────

class MembersScreen extends ConsumerStatefulWidget {
  const MembersScreen({super.key, this.initialTab = 0});
  final int initialTab;

  @override
  ConsumerState<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends ConsumerState<MembersScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this, initialIndex: widget.initialTab.clamp(0, 1));
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Members'),
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'Members'),
            Tab(text: 'Upcoming Renewals'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: const [
          _MembersTab(),
          _RenewalsTab(),
        ],
      ),
    );
  }
}

// ── Members tab ───────────────────────────────────────────────────────────────

class _MembersTab extends ConsumerWidget {
  const _MembersTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final search = ref.watch(_searchProvider);
    final status = ref.watch(_statusFilterProvider);
    final async  = ref.watch(membersListProvider(search));

    return Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Column(children: [
            TextField(
              onChanged: (v) => ref.read(_searchProvider.notifier).state = v,
              decoration: const InputDecoration(
                hintText: 'Search by name, email or phone…',
                prefixIcon: Icon(Icons.search),
                isDense: true,
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 32,
              child: ListView(scrollDirection: Axis.horizontal, children: [
                for (final s in ['all', 'active', 'frozen', 'expired', 'cancelled'])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(s == 'all' ? 'All' : s[0].toUpperCase() + s.substring(1)),
                      selected: status == s,
                      onSelected: (_) => ref.read(_statusFilterProvider.notifier).state = s,
                      selectedColor: AppColors.primary.withOpacity(0.15),
                      checkmarkColor: AppColors.primary,
                      labelStyle: TextStyle(
                        color: status == s ? AppColors.primary : AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ),
              ]),
            ),
          ]),
        ),
        Expanded(
          child: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
            data: (result) {
              if (result.members.isEmpty) {
                return Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.people_outline, size: 48, color: AppColors.textMuted),
                    const SizedBox(height: 12),
                    const Text('No members found', style: TextStyle(fontWeight: FontWeight.w600)),
                    Text(search.isNotEmpty ? 'Try a different search' : 'Add members from the web app',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                  ]),
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Text('${result.total} members',
                        style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  ),
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 80),
                      itemCount: result.members.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => _MemberTile(result.members[i]),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _MemberTile extends StatelessWidget {
  const _MemberTile(this.member);
  final Member member;

  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          leading: CircleAvatar(
            radius: 22,
            backgroundColor: AppColors.primary.withOpacity(0.1),
            backgroundImage: member.photoUrl != null ? NetworkImage(member.photoUrl!) : null,
            child: member.photoUrl == null
                ? Text(initials(member.fullName),
                    style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600, fontSize: 14))
                : null,
          ),
          title: Text(member.fullName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 2),
              Text(member.phone.isNotEmpty ? member.phone : member.email,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              if (member.planName != null) ...[
                const SizedBox(height: 3),
                Text(member.planName!, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
              ],
            ],
          ),
          trailing: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              StatusBadge(member.status),
              if (member.expiresAt != null) ...[
                const SizedBox(height: 4),
                Text(formatDate(member.expiresAt), style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
              ],
            ],
          ),
          onTap: () => context.go('/members/${member.id}'),
        ),
      );
}

// ── Renewals tab ──────────────────────────────────────────────────────────────

class _RenewalsTab extends ConsumerStatefulWidget {
  const _RenewalsTab();
  @override
  ConsumerState<_RenewalsTab> createState() => _RenewalsTabState();
}

class _RenewalsTabState extends ConsumerState<_RenewalsTab>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  _Preset _preset = _Preset.thisMonth;
  DateTimeRange? _customRange;

  Future<void> _pickCustom() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 2),
      initialDateRange: _customRange ??
          DateTimeRange(start: now, end: now.add(const Duration(days: 30))),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: AppColors.primary),
        ),
        child: child!,
      ),
    );
    if (picked != null && mounted) {
      setState(() {
        _preset = _Preset.custom;
        _customRange = picked;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final r = _rangeFor(_preset, _customRange);
    final renewals = ref.watch(renewalsProvider(r.queryDays));

    return Column(
      children: [
        // Preset picker strip
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 36,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: _Preset.values.map((p) {
                    final sel = p == _preset;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () {
                          if (p == _Preset.custom) {
                            _pickCustom();
                          } else {
                            setState(() => _preset = p);
                          }
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: sel ? AppColors.primary : AppColors.surface,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: sel ? AppColors.primary : AppColors.divider,
                            ),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(p.icon, size: 13, color: sel ? Colors.white : AppColors.textSecondary),
                            const SizedBox(width: 5),
                            Text(p.label,
                                style: TextStyle(
                                  color: sel ? Colors.white : AppColors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                  fontSize: 12,
                                )),
                          ]),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              if (_preset == _Preset.custom && _customRange != null) ...[
                const SizedBox(height: 8),
                Row(children: [
                  const Icon(Icons.date_range, size: 13, color: AppColors.textMuted),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(r.rangeLabel,
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ),
                  GestureDetector(
                    onTap: _pickCustom,
                    child: const Text('Change',
                        style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500)),
                  ),
                ]),
              ],
            ],
          ),
        ),

        // Content
        Expanded(
          child: renewals.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => _ErrView(e.toString(), () => ref.invalidate(renewalsProvider(r.queryDays))),
            data: (all) {
              final filtered = all
                  .where((s) => s.daysLeft >= r.minDay && s.daysLeft <= r.maxDay)
                  .toList()
                ..sort((a, b) => a.daysLeft.compareTo(b.daysLeft));

              if (filtered.isEmpty) {
                return Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.event_available_outlined, size: 56, color: AppColors.textMuted),
                    const SizedBox(height: 12),
                    const Text('No renewals in this period',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(r.rangeLabel,
                        style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  ]),
                );
              }

              return RefreshIndicator(
                onRefresh: () async => ref.invalidate(renewalsProvider(r.queryDays)),
                child: CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                        child: _RenewalSummaryRow(filtered),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (_, i) => _RenewalCard(filtered[i]),
                          childCount: filtered.length,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ── Renewal summary ───────────────────────────────────────────────────────────

class _RenewalSummaryRow extends StatelessWidget {
  const _RenewalSummaryRow(this.subs);
  final List<RenewalSub> subs;

  @override
  Widget build(BuildContext context) {
    final urgent = subs.where((s) => s.daysLeft <= 3).length;
    final soon   = subs.where((s) => s.daysLeft > 3 && s.daysLeft <= 14).length;

    return Row(children: [
      _SChip(Icons.people_outline, 'Total', '${subs.length}', AppColors.primary, const Color(0xFFEEF2FF)),
      const SizedBox(width: 8),
      _SChip(Icons.warning_amber_outlined, 'Urgent', '$urgent', const Color(0xFFDC2626), const Color(0xFFFEF2F2)),
      const SizedBox(width: 8),
      _SChip(Icons.schedule_outlined, 'Soon', '$soon', const Color(0xFFD97706), const Color(0xFFFFFBEB)),
    ]);
  }
}

class _SChip extends StatelessWidget {
  const _SChip(this.icon, this.label, this.value, this.color, this.bg);
  final IconData icon;
  final String label, value;
  final Color color, bg;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(width: 6),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color)),
              ]),
            ),
          ]),
        ),
      );
}

// ── Renewal card ──────────────────────────────────────────────────────────────

class _RenewalCard extends StatelessWidget {
  const _RenewalCard(this.sub);
  final RenewalSub sub;

  @override
  Widget build(BuildContext context) {
    final (fc, bc) = _urgencyColors(sub.daysLeft);
    final dayLabel = sub.daysLeft == 0
        ? 'Today'
        : sub.daysLeft == 1
            ? 'Tomorrow'
            : '${sub.daysLeft}d';

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: sub.memberId > 0 ? () => context.go('/members/${sub.memberId}') : null,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            // Avatar
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(color: bc, borderRadius: BorderRadius.circular(12)),
              child: Center(
                child: Text(_initials(sub.memberName),
                    style: TextStyle(color: fc, fontWeight: FontWeight.w700, fontSize: 15)),
              ),
            ),
            const SizedBox(width: 12),

            // Info
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(sub.memberName.isEmpty ? 'Unknown' : sub.memberName,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                const SizedBox(height: 2),
                Text(sub.planName, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                const SizedBox(height: 3),
                Row(children: [
                  const Icon(Icons.calendar_today_outlined, size: 11, color: AppColors.textMuted),
                  const SizedBox(width: 3),
                  Text('Expires ${formatDate(sub.endDate)}',
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                ]),
              ]),
            ),

            // Days badge
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: bc, borderRadius: BorderRadius.circular(10)),
                child: Text(dayLabel,
                    style: TextStyle(color: fc, fontSize: 13, fontWeight: FontWeight.w700)),
              ),
              if (sub.memberCode.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(sub.memberCode, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
              ],
            ]),
          ]),
        ),
      ),
    );
  }

  static (Color, Color) _urgencyColors(int days) {
    if (days <= 3)  return (const Color(0xFFDC2626), const Color(0xFFFEF2F2));
    if (days <= 14) return (const Color(0xFFD97706), const Color(0xFFFFFBEB));
    return (const Color(0xFF059669), const Color(0xFFECFDF5));
  }

  static String _initials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    if (name.isNotEmpty) return name[0].toUpperCase();
    return '?';
  }
}

// ── Error view ────────────────────────────────────────────────────────────────

class _ErrView extends StatelessWidget {
  const _ErrView(this.msg, this.onRetry);
  final String msg;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.error_outline, size: 48, color: AppColors.error),
          const SizedBox(height: 12),
          const Text('Could not load renewals',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(msg,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: onRetry, child: const Text('Retry')),
        ]),
      );
}

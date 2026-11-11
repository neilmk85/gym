import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/formatters.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/dashboard_repository.dart';

// ── colours used only in this file ─────────────────────────────────────────
const _green  = Color(0xFF059669);
const _greenBg= Color(0xFFECFDF5);
const _blue   = Color(0xFF2563EB);
const _blueBg = Color(0xFFEFF6FF);
const _amber  = Color(0xFFD97706);
const _amberBg= Color(0xFFFFFBEB);
const _red    = Color(0xFFDC2626);
const _redBg  = Color(0xFFFEF2F2);
const _indigo = Color(0xFF4338CA);
const _violet = Color(0xFF7C3AED);

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user       = ref.watch(authUserProvider).valueOrNull;
    final statsAsync = ref.watch(dashboardStatsProvider);
    final expiringAsync = ref.watch(expiringMembersProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(dashboardStatsProvider);
          ref.invalidate(expiringMembersProvider);
        },
        child: CustomScrollView(
          slivers: [
            _AppBar(user?.firstName ?? 'Admin'),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  statsAsync.when(
                    loading: () => _Shimmer(),
                    error:   (e, _) => _ErrCard('Error: $e'),
                    data:    (s) => _StatsSection(s, context),
                  ),
                  const SizedBox(height: 24),
                  _sectionHeader('Quick Actions'),
                  const SizedBox(height: 10),
                  Row(children: [
                    _QuickBtn(Icons.people_outline,        'Members',    () => context.go('/members')),
                    const SizedBox(width: 10),
                    _QuickBtn(Icons.how_to_reg_outlined,   'Attendance', () => context.go('/attendance')),
                    const SizedBox(width: 10),
                    _QuickBtn(Icons.fitness_center_outlined,'PT',        () => context.go('/pt-sessions')),
                  ]),
                  const SizedBox(height: 24),
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    _sectionHeader('Expiring Memberships'),
                    TextButton(onPressed: () => context.go('/members'), child: const Text('View all')),
                  ]),
                  const SizedBox(height: 8),
                  expiringAsync.when(
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error:   (e, _) => _ErrCard('Error: $e'),
                    data: (list) => list.isEmpty
                        ? _EmptyCard(Icons.check_circle_outline, 'No expiring memberships', 'All memberships are up to date')
                        : Column(children: list.take(5).map((m) => _ExpiringTile(m, context)).toList()),
                  ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── App bar ─────────────────────────────────────────────────────────────────

class _AppBar extends ConsumerWidget {
  const _AppBar(this.firstName);
  final String firstName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final h = DateTime.now().hour;
    final greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return SliverAppBar(
      expandedHeight: 130,
      pinned: true,
      backgroundColor: _indigo,
      actions: [
        IconButton(
          icon: const Icon(Icons.logout, color: Colors.white),
          onPressed: () => ref.read(authUserProvider.notifier).logout(),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [_indigo, _violet],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          padding: const EdgeInsets.fromLTRB(20, 60, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.end, children: [
            Text('$greeting, $firstName', style: const TextStyle(color: Colors.white70, fontSize: 13)),
            const SizedBox(height: 2),
            const Text('Dashboard', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
          ]),
        ),
      ),
    );
  }
}

// ── Stats section ────────────────────────────────────────────────────────────

class _StatsSection extends StatelessWidget {
  const _StatsSection(this.s, this.ctx);
  final DashboardStats s;
  final BuildContext ctx;

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

    // ── Card 1: Members ────────────────────────────────────────────────────
    _Tappable(
      onTap: () => ctx.push('/members'),
      child: _MembersCard(total: s.totalMembers, active: s.activeMembers, frozen: s.frozenMembers),
    ),
    const SizedBox(height: 12),

    // ── Card 2: Revenue (wide with trend) ─────────────────────────────────
    _Tappable(
      onTap: () => ctx.push('/payments'),
      child: _RevenueCard(thisMonth: s.revenueThisMonth, lastMonth: s.revenueLastMonth, pct: s.revenueChangePct),
    ),
    const SizedBox(height: 12),

    // ── Row: New admissions + Renewals due ────────────────────────────────
    Row(children: [
      Expanded(child: _Tappable(
        onTap: () => ctx.push('/members'),
        child: _SmallCard(
          icon: Icons.person_add_outlined,
          label: 'New Admissions',
          value: '${s.newAdmissionsThisMonth}',
          sub: 'this month',
          color: _blue, bg: _blueBg,
        ),
      )),
      const SizedBox(width: 12),
      Expanded(child: _Tappable(
        onTap: () => ctx.push('/members?tab=renewals'),
        child: _SmallCard(
          icon: Icons.autorenew_outlined,
          label: 'Renewals Due',
          value: '${s.renewalsDueThisWeek}',
          sub: 'this week',
          color: _amber, bg: _amberBg,
          alert: s.renewalsDueThisWeek > 0,
        ),
      )),
    ]),
    const SizedBox(height: 12),

    // ── Card 3: Due payments ──────────────────────────────────────────────
    _Tappable(
      onTap: () => ctx.push('/payments?status=pending'),
      child: _DuePaymentsCard(count: s.pendingPaymentsCount, amount: s.pendingPaymentsAmount),
    ),
    const SizedBox(height: 12),

    // ── Row: PT today + Members inside ───────────────────────────────────
    Row(children: [
      Expanded(child: _Tappable(
        onTap: () => ctx.push('/pt-sessions'),
        child: _PTCard(
          scheduled: s.ptSessionsScheduled,
          completed: s.ptSessionsCompleted,
          noShow: s.ptSessionsNoShow,
        ),
      )),
      const SizedBox(width: 12),
      Expanded(child: _Tappable(
        onTap: () => ctx.push('/attendance'),
        child: _SmallCard(
          icon: Icons.sensor_door_outlined,
          label: 'Inside Now',
          value: '${s.membersInsideNow}',
          sub: 'members present',
          color: _green, bg: _greenBg,
        ),
      )),
    ]),
  ]);
}

// ── Card widgets ─────────────────────────────────────────────────────────────

class _MembersCard extends StatelessWidget {
  const _MembersCard({required this.total, required this.active, required this.frozen});
  final int total, active, frozen;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
    decoration: BoxDecoration(
      gradient: const LinearGradient(colors: [_indigo, _violet], begin: Alignment.topLeft, end: Alignment.bottomRight),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(children: [
      Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
        child: const Icon(Icons.people_outline, color: Colors.white, size: 24),
      ),
      const SizedBox(width: 14),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Members', style: TextStyle(color: Colors.white70, fontSize: 12)),
        Text('$total', style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w700, height: 1.1)),
        const Text('total', style: TextStyle(color: Colors.white54, fontSize: 11)),
      ])),
      Column(children: [
        _Chip('$active', 'active', const Color(0xFF6EE7B7), const Color(0xFF064E3B)),
        const SizedBox(height: 6),
        _Chip('$frozen', 'frozen', const Color(0xFF93C5FD), const Color(0xFF1E3A5F)),
      ]),
    ]),
  );
}

class _Chip extends StatelessWidget {
  const _Chip(this.val, this.label, this.fg, this.bg);
  final String val, label;
  final Color fg, bg;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Text(val, style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 14)),
      const SizedBox(width: 4),
      Text(label, style: TextStyle(color: fg.withValues(alpha: 0.8), fontSize: 11)),
    ]),
  );
}

class _RevenueCard extends StatelessWidget {
  const _RevenueCard({required this.thisMonth, required this.lastMonth, required this.pct});
  final num thisMonth, lastMonth, pct;

  @override
  Widget build(BuildContext context) {
    final up      = pct >= 0;
    final pctText = '${up ? '+' : ''}${pct.abs().toStringAsFixed(1)}%';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: _greenBg, borderRadius: BorderRadius.circular(16), border: Border.all(color: _green.withValues(alpha: 0.2))),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: _green.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
          child: const Icon(Icons.currency_rupee_rounded, color: _green, size: 24),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Revenue This Month', style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500)),
          const SizedBox(height: 4),
          Text(formatCurrency(thisMonth), style: const TextStyle(color: _green, fontSize: 26, fontWeight: FontWeight.w700, height: 1)),
          const SizedBox(height: 4),
          Text('Last month: ${formatCurrency(lastMonth)}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
        ])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: (up ? _green : _red).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(up ? Icons.trending_up : Icons.trending_down, color: up ? _green : _red, size: 16),
            const SizedBox(width: 4),
            Text(pctText, style: TextStyle(color: up ? _green : _red, fontWeight: FontWeight.w700, fontSize: 13)),
          ]),
        ),
      ]),
    );
  }
}

class _DuePaymentsCard extends StatelessWidget {
  const _DuePaymentsCard({required this.count, required this.amount});
  final int count;
  final num amount;

  @override
  Widget build(BuildContext context) {
    final allClear = count == 0;
    final color  = allClear ? _green : _red;
    final bg     = allClear ? _greenBg : _redBg;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16), border: Border.all(color: color.withValues(alpha: 0.2))),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
          child: Icon(allClear ? Icons.check_circle_outline : Icons.payments_outlined, color: color, size: 24),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Due Payments', style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500)),
          const SizedBox(height: 4),
          Text(allClear ? 'All clear' : formatCurrency(amount),
              style: TextStyle(color: color, fontSize: 22, fontWeight: FontWeight.w700, height: 1)),
          if (!allClear)
            Text('$count member${count > 1 ? 's' : ''} with pending dues',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
          if (allClear)
            const Text('No pending dues', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
        ])),
      ]),
    );
  }
}

class _PTCard extends StatelessWidget {
  const _PTCard({required this.scheduled, required this.completed, required this.noShow});
  final int scheduled, completed, noShow;

  @override
  Widget build(BuildContext context) {
    final total = scheduled + completed + noShow;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F3FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _violet.withValues(alpha: 0.15)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.fitness_center_outlined, color: _violet, size: 18),
          const SizedBox(width: 6),
          const Text('PT Today', style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500)),
        ]),
        const SizedBox(height: 10),
        Text('$total', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: _violet, height: 1)),
        const Text('sessions', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
        const SizedBox(height: 10),
        _PTRow(Icons.schedule_outlined,       '$scheduled scheduled', const Color(0xFF2563EB)),
        const SizedBox(height: 4),
        _PTRow(Icons.check_circle_outline,    '$completed completed', _green),
        const SizedBox(height: 4),
        _PTRow(Icons.person_off_outlined,     '$noShow no-show',      noShow > 0 ? _red : AppColors.textMuted),
      ]),
    );
  }
}

class _PTRow extends StatelessWidget {
  const _PTRow(this.icon, this.label, this.color);
  final IconData icon;
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Row(children: [
    Icon(icon, size: 12, color: color),
    const SizedBox(width: 4),
    Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w500)),
  ]);
}

class _SmallCard extends StatelessWidget {
  const _SmallCard({required this.icon, required this.label, required this.value,
      required this.color, required this.bg, this.sub, this.alert = false});
  final IconData icon;
  final String label, value;
  final String? sub;
  final Color color, bg;
  final bool alert;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: color.withValues(alpha: 0.15)),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Icon(icon, color: color, size: 18),
        if (alert) ...[
          const Spacer(),
          Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        ],
      ]),
      const SizedBox(height: 10),
      Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: color, height: 1)),
      const SizedBox(height: 2),
      Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
      if (sub != null)
        Text(sub!, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
    ]),
  );
}

// ── Tappable wrapper ──────────────────────────────────────────────────────────

class _Tappable extends StatelessWidget {
  const _Tappable({required this.child, required this.onTap});
  final Widget child;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Stack(children: [
      child,
      Positioned.fill(
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(16),
            splashColor: Colors.white.withValues(alpha: 0.1),
            highlightColor: Colors.white.withValues(alpha: 0.05),
          ),
        ),
      ),
    ]),
  );
}

// ── Quick action button ───────────────────────────────────────────────────────

Widget _QuickBtn(IconData icon, String label, VoidCallback onTap) => Expanded(
  child: GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.divider)),
      child: Column(children: [
        Icon(icon, color: AppColors.primary, size: 22),
        const SizedBox(height: 6),
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
      ]),
    ),
  ),
);

// ── Section header ────────────────────────────────────────────────────────────

Widget _sectionHeader(String title) => Text(title,
    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary));

// ── Expiring tile ─────────────────────────────────────────────────────────────

class _ExpiringTile extends StatelessWidget {
  const _ExpiringTile(this.m, this.ctx);
  final ExpiringMember m;
  final BuildContext ctx;

  @override
  Widget build(BuildContext context) {
    final days    = daysUntil(m.expiresAt);
    final daysNum = int.tryParse(days.split(' ')[0]) ?? 999;
    final urgent  = daysNum <= 3;
    final color   = urgent ? _red : _amber;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.1),
          child: Text(initials(m.name), style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13)),
        ),
        title: Text(m.name, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
        subtitle: Text(m.plan, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
          child: Text(days, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
        ),
        onTap: () => ctx.go('/members/${m.id}'),
      ),
    );
  }
}

// ── Shared small widgets ──────────────────────────────────────────────────────

class _ErrCard extends StatelessWidget {
  const _ErrCard(this.msg);
  final String msg;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(padding: const EdgeInsets.all(16),
        child: Text(msg, style: const TextStyle(color: AppColors.error, fontSize: 12))));
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard(this.icon, this.title, this.sub);
  final IconData icon;
  final String title, sub;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      child: Column(children: [
        Icon(icon, size: 36, color: AppColors.textMuted),
        const SizedBox(height: 8),
        Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(sub, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
      ]),
    ),
  );
}

class _Shimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    Widget box(double h) => Container(
      height: h, margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: AppColors.divider, borderRadius: BorderRadius.circular(16)),
    );
    return Column(children: [
      box(80),
      box(76),
      Row(children: [
        Expanded(child: box(100)),
        const SizedBox(width: 12),
        Expanded(child: box(100)),
      ]),
      box(76),
      Row(children: [
        Expanded(child: box(130)),
        const SizedBox(width: 12),
        Expanded(child: box(130)),
      ]),
    ]);
  }
}

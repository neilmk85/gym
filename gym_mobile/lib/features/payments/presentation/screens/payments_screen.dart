import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/formatters.dart';
import '../../data/payments_repository.dart';

const _green  = Color(0xFF059669);
const _greenBg= Color(0xFFECFDF5);
const _red    = Color(0xFFDC2626);
const _redBg  = Color(0xFFFEF2F2);
const _amber  = Color(0xFFD97706);
const _amberBg= Color(0xFFFFFBEB);
const _indigo = Color(0xFF4338CA);
const _violet = Color(0xFF7C3AED);

const _tabs = ['all', 'pending', 'completed'];
const _tabLabels = ['All', 'Pending', 'Completed'];

class PaymentsScreen extends ConsumerStatefulWidget {
  const PaymentsScreen({super.key, this.initialStatus});
  final String? initialStatus;

  @override
  ConsumerState<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends ConsumerState<PaymentsScreen> {
  late int _tabIdx;

  @override
  void initState() {
    super.initState();
    final s = widget.initialStatus?.toLowerCase() ?? 'all';
    _tabIdx = _tabs.indexOf(s).clamp(0, _tabs.length - 1);
    if (_tabIdx < 0) _tabIdx = 0;
  }

  @override
  Widget build(BuildContext context) {
    final status   = _tabs[_tabIdx];
    final payments = ref.watch(paymentsProvider(status));

    return Scaffold(
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [_AppBar()],
        body: Column(children: [
          _TabBar(_tabIdx, (i) => setState(() => _tabIdx = i)),
          Expanded(
            child: payments.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error:   (e, _) => _ErrView(e.toString(), () => ref.invalidate(paymentsProvider(status))),
              data:    (d)    => _PaymentsList(d.payments, d.total, status),
            ),
          ),
        ]),
      ),
    );
  }
}

// ── App bar ───────────────────────────────────────────────────────────────────

class _AppBar extends StatelessWidget {
  @override
  Widget build(BuildContext context) => SliverAppBar(
    expandedHeight: 100,
    pinned: true,
    backgroundColor: _indigo,
    automaticallyImplyLeading: false,
    flexibleSpace: FlexibleSpaceBar(
      background: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [_indigo, _violet], begin: Alignment.topLeft, end: Alignment.bottomRight),
        ),
        padding: const EdgeInsets.fromLTRB(20, 60, 20, 16),
        child: const Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.end, children: [
          Text('Payments', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
        ]),
      ),
    ),
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

class _TabBar extends StatelessWidget {
  const _TabBar(this.selected, this.onSelect);
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) => Container(
    color: Colors.white,
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
    child: Row(children: List.generate(_tabs.length, (i) {
      final active = i == selected;
      return Padding(
        padding: EdgeInsets.only(right: i < _tabs.length - 1 ? 8 : 0),
        child: GestureDetector(
          onTap: () => onSelect(i),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: active ? AppColors.primary : AppColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: active ? AppColors.primary : AppColors.divider),
            ),
            child: Text(_tabLabels[i],
              style: TextStyle(
                color: active ? Colors.white : AppColors.textSecondary,
                fontWeight: FontWeight.w500,
                fontSize: 13,
              ),
            ),
          ),
        ),
      );
    })),
  );
}

// ── Payments list ─────────────────────────────────────────────────────────────

class _PaymentsList extends StatelessWidget {
  const _PaymentsList(this.payments, this.total, this.status);
  final List<Payment> payments;
  final int total;
  final String status;

  @override
  Widget build(BuildContext context) {
    if (payments.isEmpty) {
      return _EmptyView(status == 'pending' ? 'No pending payments' : 'No payments found',
          status == 'pending' ? 'All dues are cleared!' : 'Nothing here yet');
    }

    final completedAmount = payments.where((p) => p.isPaid).fold<num>(0, (s, p) => s + p.amount);
    final pendingAmount   = payments.where((p) => p.isPending).fold<num>(0, (s, p) => s + p.amount);

    return RefreshIndicator(
      onRefresh: () async {},
      child: CustomScrollView(
        slivers: [
          // Summary strip
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: _SummaryRow(
                total: total,
                completedAmt: completedAmount,
                pendingAmt: pendingAmount,
                status: status,
              ),
            ),
          ),

          // List
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, i) => _PaymentCard(payments[i]),
                childCount: payments.length,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Summary row ───────────────────────────────────────────────────────────────

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.total, required this.completedAmt, required this.pendingAmt, required this.status});
  final int total;
  final num completedAmt, pendingAmt;
  final String status;

  @override
  Widget build(BuildContext context) => Row(children: [
    _SummaryChip(Icons.receipt_long_outlined, 'Total', '$total', AppColors.primary, const Color(0xFFEEF2FF)),
    const SizedBox(width: 10),
    if (status != 'pending')
      Expanded(child: _SummaryChip(Icons.check_circle_outline, 'Collected', formatCurrency(completedAmt), _green, _greenBg)),
    if (status != 'pending') const SizedBox(width: 10),
    if (status != 'completed')
      Expanded(child: _SummaryChip(Icons.pending_outlined, 'Pending', formatCurrency(pendingAmt), _amber, _amberBg)),
  ]);
}

class _SummaryChip extends StatelessWidget {
  const _SummaryChip(this.icon, this.label, this.value, this.color, this.bg);
  final IconData icon;
  final String label, value;
  final Color color, bg;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color), overflow: TextOverflow.ellipsis),
        ])),
      ]),
    ),
  );
}

// ── Payment card ──────────────────────────────────────────────────────────────

class _PaymentCard extends StatelessWidget {
  const _PaymentCard(this.p);
  final Payment p;

  @override
  Widget build(BuildContext context) {
    final (statusColor, statusBg, statusLabel) = _statusStyle(p);

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          // Avatar
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: statusBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                _initials(p.memberName),
                style: TextStyle(color: statusColor, fontWeight: FontWeight.w700, fontSize: 15),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Name + plan + date
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(p.memberName.isEmpty ? 'Unknown Member' : p.memberName,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.textPrimary)),
            const SizedBox(height: 2),
            Text(p.plan, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            const SizedBox(height: 4),
            Row(children: [
              const Icon(Icons.calendar_today_outlined, size: 11, color: AppColors.textMuted),
              const SizedBox(width: 3),
              Text(p.displayDate, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
              const SizedBox(width: 10),
              const Icon(Icons.payment_outlined, size: 11, color: AppColors.textMuted),
              const SizedBox(width: 3),
              Text(_methodLabel(p.method), style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
            ]),
          ])),

          // Amount + status badge
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(formatCurrency(p.amount),
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: statusColor)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(8)),
              child: Text(statusLabel,
                  style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600)),
            ),
          ]),
        ]),
      ),
    );
  }

  static (Color, Color, String) _statusStyle(Payment p) {
    if (p.isPaid)    return (_green, _greenBg, 'Paid');
    if (p.isOverdue) return (_red,   _redBg,   'Overdue');
    if (p.isFailed)  return (_red,   _redBg,   'Failed');
    return (_amber, _amberBg, 'Pending');
  }

  static String _initials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    if (name.isNotEmpty) return name[0].toUpperCase();
    return '?';
  }

  static String _methodLabel(String method) => switch (method.toLowerCase()) {
    'card'         => 'Card',
    'cash'         => 'Cash',
    'upi'          => 'UPI',
    'bank_transfer'=> 'Bank',
    'cheque'       => 'Cheque',
    _              => method,
  };
}

// ── Empty / error views ───────────────────────────────────────────────────────

class _EmptyView extends StatelessWidget {
  const _EmptyView(this.title, this.sub);
  final String title, sub;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.receipt_long_outlined, size: 56, color: AppColors.textMuted),
      const SizedBox(height: 12),
      Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
      const SizedBox(height: 4),
      Text(sub, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
    ]),
  );
}

class _ErrView extends StatelessWidget {
  const _ErrView(this.msg, this.onRetry);
  final String msg;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.error_outline, size: 48, color: AppColors.error),
      const SizedBox(height: 12),
      const Text('Could not load payments', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
      const SizedBox(height: 4),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Text(msg, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary))),
      const SizedBox(height: 16),
      FilledButton(onPressed: onRetry, child: const Text('Retry')),
    ]),
  );
}

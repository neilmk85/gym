import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../data/members_repository.dart';

// ── providers ──────────────────────────────────────────────────────────────

final _memberDetailProvider = FutureProvider.autoDispose.family<Member, int>(
    (ref, id) => ref.read(membersRepoProvider).get(id));

final _paymentsProvider =
    FutureProvider.autoDispose.family<List<_Payment>, int>((ref, id) async {
  final res = await ref.read(dioProvider).get('/members/$id/payments',
      queryParameters: {'per_page': 50});
  final list = (res.data['data']?['payments'] ?? res.data['payments']) as List? ?? [];
  return list.map((j) => _Payment.fromJson(j as Map<String, dynamic>)).toList();
});

final _ptPackagesProvider =
    FutureProvider.autoDispose.family<List<_PTPkg>, int>((ref, id) async {
  final res = await ref.read(dioProvider).get('/members/$id/pt-packages',
      queryParameters: {'per_page': 50});
  final list = (res.data['data']?['pt_packages'] ?? res.data['pt_packages']) as List? ?? [];
  return list.map((j) => _PTPkg.fromJson(j as Map<String, dynamic>)).toList();
});

final _attendanceHistoryProvider =
    FutureProvider.autoDispose.family<List<_CheckIn>, int>((ref, id) async {
  final res = await ref.read(dioProvider).get('/members/$id/attendance',
      queryParameters: {'per_page': 50});
  final list = (res.data['data']?['attendance'] ?? res.data['attendance']) as List? ?? [];
  return list.map((j) => _CheckIn.fromJson(j as Map<String, dynamic>)).toList();
});

// ── models ─────────────────────────────────────────────────────────────────

class _Payment {
  final int id;
  final double amount;
  final String method;
  final String status;
  final String paidAt;
  final String? notes;
  const _Payment({required this.id, required this.amount, required this.method,
      required this.status, required this.paidAt, this.notes});
  factory _Payment.fromJson(Map<String, dynamic> j) => _Payment(
        id:     j['id'] as int,
        amount: (j['amount'] as num).toDouble(),
        method: j['payment_method'] as String? ?? '',
        status: j['status'] as String? ?? '',
        paidAt: j['paid_at'] as String? ?? j['created_at'] as String? ?? '',
        notes:  j['notes'] as String?,
      );
}

class _PTPkg {
  final int id;
  final String name;
  final int total;
  final int used;
  final double amount;
  final String expiresAt;
  final bool isActive;
  final String? trainerName;
  const _PTPkg({required this.id, required this.name, required this.total,
      required this.used, required this.amount, required this.expiresAt,
      required this.isActive, this.trainerName});
  factory _PTPkg.fromJson(Map<String, dynamic> j) {
    final tu = j['trainer']?['user'] as Map? ?? {};
    return _PTPkg(
      id:          j['id'] as int,
      name:        j['pt_package']?['name'] as String? ?? 'PT Package',
      total:       j['total_sessions'] as int? ?? 0,
      used:        j['used_sessions'] as int? ?? 0,
      amount:      (j['amount'] as num? ?? 0).toDouble(),
      expiresAt:   j['expires_at'] as String? ?? '',
      isActive:    j['is_active'] as bool? ?? false,
      trainerName: tu.isNotEmpty
          ? '${tu['first_name'] ?? ''} ${tu['last_name'] ?? ''}'.trim()
          : null,
    );
  }
}

class _CheckIn {
  final int id;
  final String checkInAt;
  final String? checkOutAt;
  const _CheckIn({required this.id, required this.checkInAt, this.checkOutAt});
  factory _CheckIn.fromJson(Map<String, dynamic> j) => _CheckIn(
        id:         j['id'] as int,
        checkInAt:  j['check_in_at'] as String? ?? j['created_at'] as String? ?? '',
        checkOutAt: j['check_out_at'] as String?,
      );
}

// ── screen ─────────────────────────────────────────────────────────────────

class MemberDetailScreen extends ConsumerWidget {
  const MemberDetailScreen({super.key, required this.memberId});
  final int memberId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_memberDetailProvider(memberId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Member Profile'),
        actions: [
          async.whenOrNull(
            data: (m) => PopupMenuButton<String>(
              onSelected: (action) => _handleAction(context, ref, m, action),
              itemBuilder: (_) => [
                if (m.status == 'active')
                  const PopupMenuItem(value: 'freeze', child: Text('Freeze membership')),
                if (m.status == 'frozen')
                  const PopupMenuItem(value: 'unfreeze', child: Text('Unfreeze membership')),
              ],
            ),
          ) ?? const SizedBox(),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
        data:    (m) => _TabbedBody(m),
      ),
    );
  }

  void _handleAction(BuildContext context, WidgetRef ref, Member m, String action) async {
    final repo = ref.read(membersRepoProvider);
    if (action == 'freeze') {
      final reason = await _askReason(context, 'Freeze Membership', 'Reason for freeze');
      if (reason == null) return;
      await repo.freeze(m.id, reason);
    } else if (action == 'unfreeze') {
      await repo.unfreeze(m.id);
    }
    ref.invalidate(_memberDetailProvider(m.id));
    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${action == 'freeze' ? 'Frozen' : 'Unfrozen'} successfully')));
  }

  Future<String?> _askReason(BuildContext context, String title, String hint) {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: TextField(controller: ctrl, decoration: InputDecoration(hintText: hint)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, ctrl.text),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }
}

// ── tabbed body ────────────────────────────────────────────────────────────

class _TabbedBody extends StatelessWidget {
  const _TabbedBody(this.m);
  final Member m;

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 4,
    child: Column(children: [
      Container(
        color: Colors.white,
        child: TabBar(
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          tabs: const [
            Tab(text: 'Profile'),
            Tab(text: 'Payments'),
            Tab(text: 'PT Packages'),
            Tab(text: 'Attendance'),
          ],
        ),
      ),
      Expanded(
        child: TabBarView(children: [
          _ProfileTab(m),
          _PaymentsTab(m.id),
          _PtPackagesTab(m.id),
          _AttendanceTab(m.id),
        ]),
      ),
    ]),
  );
}

// ── Profile tab ─────────────────────────────────────────────────────────────

class _ProfileTab extends StatelessWidget {
  const _ProfileTab(this.m);
  final Member m;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

      Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: AppColors.primary.withValues(alpha: 0.1),
              backgroundImage: m.photoUrl != null ? NetworkImage(m.photoUrl!) : null,
              child: m.photoUrl == null
                  ? Text(initials(m.fullName),
                      style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700, fontSize: 20))
                  : null,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(m.fullName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(m.memberCode, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                const SizedBox(height: 6),
                StatusBadge(m.status),
              ]),
            ),
          ]),
        ),
      ),
      const SizedBox(height: 12),

      _Section('Contact', [
        _InfoRow(Icons.email_outlined, 'Email', m.email),
        _InfoRow(Icons.phone_outlined, 'Phone', m.phone.isNotEmpty ? m.phone : '—'),
      ]),
      const SizedBox(height: 12),

      _Section('Membership', [
        _InfoRow(Icons.card_membership_outlined, 'Plan', m.planName ?? '—'),
        _InfoRow(Icons.calendar_today_outlined,  'Expires', formatDate(m.expiresAt)),
        _InfoRow(Icons.timer_outlined,            'Time left', daysUntil(m.expiresAt)),
      ]),
    ]),
  );
}

// ── Payments tab ─────────────────────────────────────────────────────────────

class _PaymentsTab extends ConsumerWidget {
  const _PaymentsTab(this.memberId);
  final int memberId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_paymentsProvider(memberId));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
      data: (payments) {
        if (payments.isEmpty) return _empty('No payments recorded', Icons.receipt_long_outlined);
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: payments.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final p = payments[i];
            final statusColor = p.status == 'completed' ? AppColors.success
                : p.status == 'refunded' ? AppColors.warning
                : AppColors.error;
            return Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: statusColor.withValues(alpha: 0.1),
                  child: Icon(_methodIcon(p.method), color: statusColor, size: 20),
                ),
                title: Text(formatCurrency(p.amount),
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_methodLabel(p.method),
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  if (p.notes != null && p.notes!.isNotEmpty)
                    Text(p.notes!, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                ]),
                trailing: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(p.status[0].toUpperCase() + p.status.substring(1),
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor)),
                    ),
                    const SizedBox(height: 4),
                    Text(formatDate(p.paidAt),
                        style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  IconData _methodIcon(String m) {
    switch (m) {
      case 'upi': return Icons.qr_code;
      case 'card': return Icons.credit_card;
      case 'bank_transfer': return Icons.account_balance;
      default: return Icons.payments_outlined;
    }
  }

  String _methodLabel(String m) {
    switch (m) {
      case 'upi': return 'UPI';
      case 'card': return 'Card';
      case 'bank_transfer': return 'Bank Transfer';
      case 'razorpay': return 'Razorpay';
      case 'cash': return 'Cash';
      default: return m[0].toUpperCase() + m.substring(1);
    }
  }
}

// ── PT Packages tab ───────────────────────────────────────────────────────────

class _PtPackagesTab extends ConsumerWidget {
  const _PtPackagesTab(this.memberId);
  final int memberId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_ptPackagesProvider(memberId));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
      data: (pkgs) {
        if (pkgs.isEmpty) return _empty('No PT packages purchased', Icons.fitness_center_outlined);
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: pkgs.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final p = pkgs[i];
            final remaining = p.total - p.used;
            final pct = p.total > 0 ? (p.used / p.total).clamp(0.0, 1.0) : 0.0;
            final barColor = p.isActive ? AppColors.primary : AppColors.textMuted;
            return Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(p.name,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: (p.isActive ? AppColors.success : AppColors.textMuted).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(p.isActive ? 'Active' : 'Inactive',
                          style: TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w600,
                            color: p.isActive ? AppColors.success : AppColors.textMuted,
                          )),
                    ),
                  ]),
                  const SizedBox(height: 8),
                  Row(children: [
                    Text('$remaining sessions left',
                        style: TextStyle(color: p.isActive ? AppColors.primary : AppColors.textMuted,
                            fontWeight: FontWeight.w500, fontSize: 13)),
                    const Spacer(),
                    Text('${p.used} / ${p.total} used',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  ]),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: pct,
                      backgroundColor: barColor.withValues(alpha: 0.12),
                      valueColor: AlwaysStoppedAnimation(barColor),
                      minHeight: 6,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(children: [
                    if (p.trainerName != null) ...[
                      const Icon(Icons.person_outline, size: 13, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Text(p.trainerName!,
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      const SizedBox(width: 12),
                    ],
                    const Icon(Icons.event_outlined, size: 13, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text('Expires ${formatDate(p.expiresAt)}',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    const Spacer(),
                    Text(formatCurrency(p.amount),
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary)),
                  ]),
                ]),
              ),
            );
          },
        );
      },
    );
  }
}

// ── Attendance tab ────────────────────────────────────────────────────────────

class _AttendanceTab extends ConsumerWidget {
  const _AttendanceTab(this.memberId);
  final int memberId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_attendanceHistoryProvider(memberId));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
      data: (records) {
        if (records.isEmpty) return _empty('No attendance records', Icons.how_to_reg_outlined);
        return Column(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Colors.white,
            child: Row(children: [
              const Icon(Icons.how_to_reg, size: 16, color: AppColors.primary),
              const SizedBox(width: 6),
              Text('${records.length} visits total',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary)),
            ]),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
              itemCount: records.length,
              separatorBuilder: (_, __) => const SizedBox(height: 6),
              itemBuilder: (_, i) {
                final r = records[i];
                final stillInside = r.checkOutAt == null;
                final duration = r.checkOutAt != null
                    ? _duration(r.checkInAt, r.checkOutAt!)
                    : null;
                return Card(
                  child: ListTile(
                    dense: true,
                    leading: CircleAvatar(
                      radius: 18,
                      backgroundColor: (stillInside ? AppColors.success : AppColors.primary)
                          .withValues(alpha: 0.1),
                      child: Icon(
                        stillInside ? Icons.login : Icons.logout,
                        size: 16,
                        color: stillInside ? AppColors.success : AppColors.primary,
                      ),
                    ),
                    title: Text(formatDateTime(r.checkInAt),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                    subtitle: r.checkOutAt != null
                        ? Text('Left ${formatTime(r.checkOutAt)}${duration != null ? '  ·  $duration' : ''}',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary))
                        : null,
                    trailing: stillInside
                        ? Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.success.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Text('Inside',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                                    color: AppColors.success)),
                          )
                        : null,
                  ),
                );
              },
            ),
          ),
        ]);
      },
    );
  }

  String _duration(String inStr, String outStr) {
    try {
      final d = DateTime.parse(outStr).difference(DateTime.parse(inStr));
      final h = d.inHours;
      final m = d.inMinutes % 60;
      if (h > 0) return '${h}h ${m}m';
      return '${m}m';
    } catch (_) { return ''; }
  }
}

// ── shared helpers ────────────────────────────────────────────────────────────

Widget _empty(String msg, IconData icon) => Center(
  child: Column(mainAxisSize: MainAxisSize.min, children: [
    Icon(icon, size: 48, color: AppColors.textMuted),
    const SizedBox(height: 12),
    Text(msg, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
  ]),
);

class _Section extends StatelessWidget {
  const _Section(this.title, this.rows);
  final String title;
  final List<Widget> rows;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
            color: AppColors.textSecondary)),
        const SizedBox(height: 10),
        ...rows,
      ]),
    ),
  );
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.icon, this.label, this.value);
  final IconData icon;
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(children: [
      Icon(icon, size: 18, color: AppColors.textMuted),
      const SizedBox(width: 10),
      Text('$label  ', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
      Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
          textAlign: TextAlign.end)),
    ]),
  );
}

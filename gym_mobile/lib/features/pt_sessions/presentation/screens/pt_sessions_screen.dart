import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/status_badge.dart';

class PTSession {
  final int id;
  final String memberName;
  final String trainerName;
  final String scheduledAt;
  final int durationMinutes;
  final String status;
  final String? trainerNotes;
  final String? cancelReason;

  const PTSession({
    required this.id, required this.memberName, required this.trainerName,
    required this.scheduledAt, required this.durationMinutes, required this.status,
    this.trainerNotes, this.cancelReason,
  });

  factory PTSession.fromJson(Map<String, dynamic> j) {
    final mu = j['member']?['user'] as Map? ?? {};
    final tu = j['trainer']?['user'] as Map? ?? {};
    return PTSession(
      id:              j['id'] as int,
      memberName:      '${mu['first_name'] ?? ''} ${mu['last_name'] ?? ''}'.trim(),
      trainerName:     '${tu['first_name'] ?? ''} ${tu['last_name'] ?? ''}'.trim(),
      scheduledAt:     j['scheduled_at'] as String? ?? '',
      durationMinutes: j['duration_minutes'] as int? ?? 60,
      status:          j['status'] as String? ?? 'scheduled',
      trainerNotes:    j['trainer_notes'] as String?,
      cancelReason:    j['cancel_reason'] as String?,
    );
  }
}

final _ptStatusFilter = StateProvider<String>((_) => 'all');

final ptSessionsProvider = FutureProvider.autoDispose<List<PTSession>>((ref) async {
  final dio    = ref.read(dioProvider);
  final status = ref.watch(_ptStatusFilter);
  final res = await dio.get('/pt-sessions', queryParameters: {
    'facility_id': 1,
    'per_page': 50,
    if (status != 'all') 'status': status,
  });
  final list = (res.data['data']?['pt_sessions'] ?? res.data['pt_sessions']) as List? ?? [];
  return list.map((s) => PTSession.fromJson(s as Map<String, dynamic>)).toList();
});

class PTSessionsScreen extends ConsumerWidget {
  const PTSessionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async  = ref.watch(ptSessionsProvider);
    final status = ref.watch(_ptStatusFilter);

    return Scaffold(
      appBar: AppBar(
        title: const Text('PT Sessions'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: () => ref.invalidate(ptSessionsProvider)),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: SizedBox(
              height: 32,
              child: ListView(scrollDirection: Axis.horizontal, children: [
                for (final s in ['all', 'scheduled', 'completed', 'no_show', 'cancelled'])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(s == 'all' ? 'All' : s == 'no_show' ? 'No Show' : s[0].toUpperCase() + s.substring(1)),
                      selected: status == s,
                      onSelected: (_) {
                        ref.read(_ptStatusFilter.notifier).state = s;
                        ref.invalidate(ptSessionsProvider);
                      },
                      selectedColor: AppColors.accent.withOpacity(0.15),
                      checkmarkColor: AppColors.accent,
                      labelStyle: TextStyle(
                        color: status == s ? AppColors.accent : AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ),
              ]),
            ),
          ),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
        data: (sessions) {
          if (sessions.isEmpty) {
            return Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.fitness_center_outlined, size: 48, color: AppColors.textMuted),
                const SizedBox(height: 12),
                const Text('No sessions found', style: TextStyle(fontWeight: FontWeight.w600)),
                Text(status != 'all' ? 'No $status sessions' : 'No PT sessions in this facility',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              ]),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
            itemCount: sessions.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) => _SessionCard(sessions[i], ref),
          );
        },
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard(this.s, this.ref);
  final PTSession s;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text(s.memberName.isNotEmpty ? s.memberName : 'Member',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
          ),
          StatusBadge(s.status),
        ]),
        const SizedBox(height: 6),
        Row(children: [
          const Icon(Icons.person_outline, size: 14, color: AppColors.textMuted),
          const SizedBox(width: 4),
          Text(s.trainerName.isNotEmpty ? s.trainerName : 'Trainer',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          const SizedBox(width: 12),
          const Icon(Icons.schedule_outlined, size: 14, color: AppColors.textMuted),
          const SizedBox(width: 4),
          Text('${s.durationMinutes} min',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ]),
        const SizedBox(height: 6),
        Row(children: [
          const Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.textMuted),
          const SizedBox(width: 4),
          Text(formatDateTime(s.scheduledAt),
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ]),
        if (s.trainerNotes != null && s.trainerNotes!.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(s.trainerNotes!, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontStyle: FontStyle.italic)),
        ],
        if (s.status == 'scheduled') ...[
          const SizedBox(height: 10),
          const Divider(height: 1),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: _ActionBtn(
                label: 'Complete',
                color: AppColors.success,
                icon: Icons.check_circle_outline,
                onTap: () => _complete(context),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _ActionBtn(
                label: 'No Show',
                color: AppColors.textSecondary,
                icon: Icons.person_off_outlined,
                onTap: () => _noShow(),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _ActionBtn(
                label: 'Cancel',
                color: AppColors.error,
                icon: Icons.cancel_outlined,
                onTap: () => _cancel(context),
              ),
            ),
          ]),
        ],
      ]),
    ),
  );

  Future<void> _complete(BuildContext context) async {
    final dio   = ref.read(dioProvider);
    final notes = await _ask(context, 'Session Notes', 'Optional trainer notes…', required: false);
    if (notes == null) return;
    await dio.post('/pt-sessions/${s.id}/complete', data: {'trainer_notes': notes});
    ref.invalidate(ptSessionsProvider);
  }

  Future<void> _noShow() async {
    final dio = ref.read(dioProvider);
    await dio.post('/pt-sessions/${s.id}/no-show');
    ref.invalidate(ptSessionsProvider);
  }

  Future<void> _cancel(BuildContext context) async {
    final dio    = ref.read(dioProvider);
    final reason = await _ask(context, 'Cancel Session', 'Reason for cancellation');
    if (reason == null || reason.isEmpty) return;
    await dio.post('/pt-sessions/${s.id}/cancel', data: {'reason': reason});
    ref.invalidate(ptSessionsProvider);
  }

  Future<String?> _ask(BuildContext context, String title, String hint, {bool required = true}) {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: TextField(controller: ctrl, decoration: InputDecoration(hintText: hint), maxLines: 2),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => (!required || ctrl.text.isNotEmpty) ? Navigator.pop(context, ctrl.text) : null,
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({required this.label, required this.color, required this.icon, required this.onTap});
  final String label;
  final Color color;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
      ]),
    ),
  );
}

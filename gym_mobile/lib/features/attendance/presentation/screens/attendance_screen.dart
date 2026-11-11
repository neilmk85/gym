import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/formatters.dart';

class AttendanceRecord {
  final int id;
  final String memberName;
  final String checkInAt;
  final String? checkOutAt;
  const AttendanceRecord({required this.id, required this.memberName, required this.checkInAt, this.checkOutAt});

  factory AttendanceRecord.fromJson(Map<String, dynamic> j) {
    final u = j['member']?['user'] as Map? ?? {};
    return AttendanceRecord(
      id:          j['id'] as int,
      memberName:  '${u['first_name'] ?? ''} ${u['last_name'] ?? ''}'.trim(),
      checkInAt:   j['check_in_at'] as String? ?? j['created_at'] as String? ?? '',
      checkOutAt:  j['check_out_at'] as String?,
    );
  }
}

final todayAttendanceProvider = FutureProvider.autoDispose<List<AttendanceRecord>>((ref) async {
  final dio = ref.read(dioProvider);
  final now = DateTime.now();
  final today = '${now.year}-${now.month.toString().padLeft(2,'0')}-${now.day.toString().padLeft(2,'0')}';
  final res = await dio.get('/attendance', queryParameters: {
    'facility_id': 1,
    'per_page': 100,
    'date': today,
  });
  final list = (res.data['data']?['attendance'] ?? res.data['attendance']) as List? ?? [];
  return list.map((r) => AttendanceRecord.fromJson(r as Map<String, dynamic>)).toList();
});

class AttendanceScreen extends ConsumerWidget {
  const AttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(todayAttendanceProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(todayAttendanceProvider),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
        data: (records) => Column(
          children: [
            // Summary banner
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2563EB), Color(0xFF7C3AED)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(children: [
                const Icon(Icons.how_to_reg, color: Colors.white, size: 32),
                const SizedBox(width: 16),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${records.length}',
                      style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w700)),
                  const Text("check-ins today",
                      style: TextStyle(color: Colors.white70, fontSize: 13)),
                ]),
                const Spacer(),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text('${records.where((r) => r.checkOutAt != null).length}',
                      style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w600)),
                  const Text('checked out', style: TextStyle(color: Colors.white70, fontSize: 11)),
                  const SizedBox(height: 4),
                  Text('${records.where((r) => r.checkOutAt == null).length}',
                      style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w600)),
                  const Text('still inside', style: TextStyle(color: Colors.white70, fontSize: 11)),
                ]),
              ]),
            ),

            // List header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(children: [
                const Text("Today's Log", style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                const Spacer(),
                Text(formatDate(DateTime.now().toIso8601String()),
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              ]),
            ),

            if (records.isEmpty)
              const Expanded(
                child: Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.people_outline, size: 48, color: AppColors.textMuted),
                    SizedBox(height: 12),
                    Text('No check-ins yet today', style: TextStyle(fontWeight: FontWeight.w500)),
                    SizedBox(height: 4),
                    Text('Members who check in will appear here',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                  ]),
                ),
              )
            else
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                  itemCount: records.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 6),
                  itemBuilder: (_, i) {
                    final r = records[i];
                    final stillInside = r.checkOutAt == null;
                    return Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: stillInside
                              ? AppColors.success.withOpacity(0.1)
                              : AppColors.textMuted.withOpacity(0.1),
                          child: Icon(
                            stillInside ? Icons.person : Icons.person_off_outlined,
                            color: stillInside ? AppColors.success : AppColors.textMuted,
                            size: 20,
                          ),
                        ),
                        title: Text(r.memberName.isNotEmpty ? r.memberName : 'Member #${r.id}',
                            style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
                        subtitle: Text(
                          'In: ${formatTime(r.checkInAt)}${r.checkOutAt != null ? '  ·  Out: ${formatTime(r.checkOutAt)}' : ''}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: stillInside ? AppColors.success.withOpacity(0.1) : AppColors.textMuted.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            stillInside ? 'Inside' : 'Left',
                            style: TextStyle(
                              color: stillInside ? AppColors.success : AppColors.textMuted,
                              fontSize: 11, fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

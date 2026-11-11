import 'package:dio/dio.dart' show Dio, Response;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

class DashboardStats {
  final int totalMembers;
  final int activeMembers;
  final int frozenMembers;
  final num revenueThisMonth;
  final num revenueLastMonth;
  final int newAdmissionsThisMonth;
  final int renewalsDueThisWeek;
  final int pendingPaymentsCount;
  final num pendingPaymentsAmount;
  final int ptSessionsScheduled;
  final int ptSessionsCompleted;
  final int ptSessionsNoShow;
  final int membersInsideNow;
  final int newInquiries; // placeholder — no backend endpoint yet

  const DashboardStats({
    required this.totalMembers,
    required this.activeMembers,
    required this.frozenMembers,
    required this.revenueThisMonth,
    required this.revenueLastMonth,
    required this.newAdmissionsThisMonth,
    required this.renewalsDueThisWeek,
    required this.pendingPaymentsCount,
    required this.pendingPaymentsAmount,
    required this.ptSessionsScheduled,
    required this.ptSessionsCompleted,
    required this.ptSessionsNoShow,
    required this.membersInsideNow,
    this.newInquiries = 0,
  });

  num get revenueChangePct {
    if (revenueLastMonth == 0) return revenueThisMonth > 0 ? 100 : 0;
    return ((revenueThisMonth - revenueLastMonth) / revenueLastMonth * 100);
  }

  int get ptSessionsTotal => ptSessionsScheduled + ptSessionsCompleted + ptSessionsNoShow;
}

class ExpiringMember {
  final int id;
  final String name;
  final String plan;
  final String expiresAt;
  const ExpiringMember({required this.id, required this.name, required this.plan, required this.expiresAt});
}

class DashboardRepository {
  DashboardRepository(this._dio);
  final Dio _dio;

  Future<DashboardStats> getStats() async {
    final today = _today();

    // Main dashboard report — required; if this fails we propagate the error
    final mainRes = await _dio.get('/reports/dashboard', queryParameters: {'facility_id': 1});
    final r = mainRes.data['data'] as Map<String, dynamic>? ?? {};

    // Secondary calls — each wrapped so a single failure returns a default
    final results = await Future.wait([
      _safe(() => _dio.get('/members',      queryParameters: {'facility_id': 1, 'status': 'frozen',  'per_page': 1})),
      _safe(() => _dio.get('/subscriptions',queryParameters: {'facility_id': 1, 'expiring_days': 7,  'per_page': 1})),
      _safe(() => _dio.get('/payments',     queryParameters: {'facility_id': 1, 'status': 'pending', 'per_page': 100})),
      _safe(() => _dio.get('/pt-sessions',  queryParameters: {'facility_id': 1, 'per_page': 100})),
      _safe(() => _dio.get('/attendance',   queryParameters: {'facility_id': 1, 'date': today, 'per_page': 1})),
    ]);

    final d1 = results[0]?['data'] as Map? ?? {};
    final d2 = results[1]?['data'] as Map? ?? {};
    final d3 = results[2]?['data'] as Map? ?? {};
    final d4 = results[3]?['data'] as Map? ?? {};
    final d5 = results[4]?['data'] as Map? ?? {};

    // Pending payment amount — sum all pending payment amounts
    final pendingList = d3['payments'] as List? ?? [];
    final pendingAmt  = pendingList.fold<num>(0, (s, p) => s + ((p as Map)['amount'] as num? ?? 0));

    // PT sessions breakdown by status
    final sessions = d4['pt_sessions'] as List? ?? [];
    int scheduled = 0, completed = 0, noShow = 0;
    for (final s in sessions) {
      switch ((s as Map)['status']) {
        case 'scheduled': scheduled++; break;
        case 'completed': completed++; break;
        case 'no_show':   noShow++;    break;
      }
    }

    // Live occupancy: attendance records with no check-out time
    final attendanceList = d5['attendance'] as List? ?? [];
    final insideNow = attendanceList
        .where((a) { final m = a as Map; return m['check_out_time'] == null || m['check_out_time'] == ''; })
        .length;

    return DashboardStats(
      totalMembers:           r['total_members']          as int? ?? 0,
      activeMembers:          r['active_members']         as int? ?? 0,
      frozenMembers:          d1['meta']?['total']        as int? ?? 0,
      revenueThisMonth:       r['revenue_this_month']     as num? ?? 0,
      revenueLastMonth:       r['revenue_last_month']     as num? ?? 0,
      newAdmissionsThisMonth: r['new_members_this_month'] as int? ?? 0,
      renewalsDueThisWeek:    d2['meta']?['total']        as int? ?? 0,
      pendingPaymentsCount:   pendingList.length,
      pendingPaymentsAmount:  pendingAmt,
      ptSessionsScheduled:    scheduled,
      ptSessionsCompleted:    completed,
      ptSessionsNoShow:       noShow,
      membersInsideNow:       insideNow,
    );
  }

  // Returns the response body map on success, null on any error
  Future<Map<String, dynamic>?> _safe(Future<Response> Function() call) async {
    try {
      final res = await call();
      return res.data as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }

  Future<List<ExpiringMember>> getExpiringMembers() async {
    final res = await _dio.get('/subscriptions', queryParameters: {
      'facility_id': 1, 'per_page': 10, 'expiring_days': 7, 'status': 'active',
    });
    final body = res.data['data'] as Map? ?? {};
    final list = body['subscriptions'] as List? ?? [];
    return list.map((s) {
      final m = s['member'] as Map? ?? {};
      final u = m['user'] as Map? ?? {};
      return ExpiringMember(
        id:        m['id'] as int? ?? 0,
        name:      '${u['first_name'] ?? ''} ${u['last_name'] ?? ''}'.trim(),
        plan:      s['plan']?['name'] as String? ?? 'Unknown plan',
        expiresAt: s['end_date'] as String? ?? '',
      );
    }).toList();
  }

  String _today() {
    final n = DateTime.now();
    return '${n.year}-${n.month.toString().padLeft(2,'0')}-${n.day.toString().padLeft(2,'0')}';
  }
}

final dashboardRepoProvider    = Provider((ref) => DashboardRepository(ref.read(dioProvider)));
final dashboardStatsProvider   = FutureProvider<DashboardStats>((ref) => ref.read(dashboardRepoProvider).getStats());
final expiringMembersProvider  = FutureProvider<List<ExpiringMember>>((ref) => ref.read(dashboardRepoProvider).getExpiringMembers());

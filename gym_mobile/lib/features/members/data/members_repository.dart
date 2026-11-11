import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

class Member {
  final int id;
  final String memberCode;
  final String firstName;
  final String lastName;
  final String email;
  final String phone;
  final String status;
  final String? planName;
  final String? expiresAt;
  final String? photoUrl;

  const Member({
    required this.id, required this.memberCode,
    required this.firstName, required this.lastName,
    required this.email, required this.phone,
    required this.status,
    this.planName, this.expiresAt, this.photoUrl,
  });

  String get fullName => '$firstName $lastName'.trim();

  factory Member.fromJson(Map<String, dynamic> j) {
    final u   = j['user'] as Map<String, dynamic>? ?? {};
    final sub = (j['subscriptions'] as List?)?.firstOrNull as Map<String, dynamic>?;
    return Member(
      id:         j['id'] as int,
      memberCode: j['member_code'] as String? ?? '',
      firstName:  u['first_name'] as String? ?? '',
      lastName:   u['last_name'] as String? ?? '',
      email:      u['email'] as String? ?? '',
      phone:      u['phone'] as String? ?? '',
      status:     j['membership_status'] as String? ?? j['status'] as String? ?? 'active',
      planName:   sub?['plan']?['name'] as String?,
      expiresAt:  sub?['end_date'] as String?,
      photoUrl:   u['profile_photo_url'] as String?,
    );
  }
}

class MembersRepository {
  MembersRepository(this._dio);
  final Dio _dio;

  Future<({List<Member> members, int total})> list({
    String? search,
    String? status,
    int page = 1,
    int perPage = 20,
  }) async {
    final res = await _dio.get('/members', queryParameters: {
      'facility_id': 1,
      'per_page': perPage,
      'page': page,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status != 'all') 'status': status,
    });
    final body  = res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>;
    final list  = (body['members'] as List? ?? []).map((m) => Member.fromJson(m as Map<String, dynamic>)).toList();
    final total = body['meta']?['total'] as int? ?? list.length;
    return (members: list, total: total);
  }

  Future<Member> get(int id) async {
    final res = await _dio.get('/members/$id');
    return Member.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  Future<void> freeze(int id, String reason) =>
      _dio.post('/members/$id/freeze', data: {'reason': reason});

  Future<void> unfreeze(int id) => _dio.post('/members/$id/unfreeze');

  Future<List<RenewalSub>> listRenewals({int expiringDays = 30}) async {
    final res = await _dio.get('/subscriptions', queryParameters: {
      'facility_id': 1,
      'expiring_days': expiringDays,
      'per_page': 100,
    });
    final body = res.data['data'] as Map? ?? {};
    return (body['subscriptions'] as List? ?? [])
        .map((s) => RenewalSub.fromJson(s as Map<String, dynamic>))
        .toList();
  }
}

final membersRepoProvider = Provider((ref) => MembersRepository(ref.read(dioProvider)));

// ── Renewal subscription ──────────────────────────────────────────────────────

class RenewalSub {
  final int id;
  final int memberId;
  final String memberName;
  final String memberCode;
  final String planName;
  final String endDate;
  final int daysLeft; // 0 = today, negative = already expired

  const RenewalSub({
    required this.id, required this.memberId,
    required this.memberName, required this.memberCode,
    required this.planName, required this.endDate, required this.daysLeft,
  });

  factory RenewalSub.fromJson(Map<String, dynamic> j) {
    final m    = j['member'] as Map? ?? {};
    final u    = m['user']   as Map? ?? {};
    final plan = j['plan']   as Map? ?? {};
    final endDateStr = j['end_date'] as String? ?? '';
    final dt   = DateTime.tryParse(endDateStr)?.toLocal() ?? DateTime.now();
    final now  = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final dtStart    = DateTime(dt.year, dt.month, dt.day);
    return RenewalSub(
      id:         j['id'] as int,
      memberId:   m['id']  as int? ?? 0,
      memberName: '${u['first_name'] ?? ''} ${u['last_name'] ?? ''}'.trim(),
      memberCode: m['member_code'] as String? ?? '',
      planName:   plan['name'] as String? ?? 'Membership',
      endDate:    endDateStr,
      daysLeft:   dtStart.difference(todayStart).inDays,
    );
  }
}

final renewalsProvider = FutureProvider.autoDispose
    .family<List<RenewalSub>, int>((ref, expiringDays) async {
  final repo = ref.read(membersRepoProvider);
  return repo.listRenewals(expiringDays: expiringDays);
});

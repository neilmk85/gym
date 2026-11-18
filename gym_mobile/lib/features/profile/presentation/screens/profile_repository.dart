import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';

class AttendanceRecord {
  final int id;
  final String checkInTime;
  final String? checkOutTime;
  final String date;

  const AttendanceRecord({
    required this.id,
    required this.checkInTime,
    this.checkOutTime,
    required this.date,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> j) {
    final checkIn  = j['check_in_time']  as String? ?? j['created_at'] as String? ?? '';
    final checkOut = j['check_out_time'] as String?;
    String date = '';
    try {
      date = checkIn.substring(0, 10);
    } catch (_) {}
    return AttendanceRecord(
      id:           j['id'] as int,
      checkInTime:  checkIn,
      checkOutTime: checkOut,
      date:         date,
    );
  }
}

class PaymentRecord {
  final int id;
  final double amount;
  final String status;
  final String date;
  final String? planName;
  final String? method;

  const PaymentRecord({
    required this.id,
    required this.amount,
    required this.status,
    required this.date,
    this.planName,
    this.method,
  });

  factory PaymentRecord.fromJson(Map<String, dynamic> j) {
    final sub  = j['subscription'] as Map? ?? {};
    final plan = sub['plan']       as Map? ?? {};
    return PaymentRecord(
      id:       j['id'] as int,
      amount:   (j['amount'] as num? ?? 0).toDouble(),
      status:   j['status'] as String? ?? 'paid',
      date:     j['payment_date'] as String? ?? j['created_at'] as String? ?? '',
      planName: plan['name'] as String?,
      method:   j['payment_method'] as String?,
    );
  }
}

class MemberStats {
  final int totalVisits;
  final int thisMonthVisits;
  final int streak;
  final Set<String> visitDates;

  const MemberStats({
    required this.totalVisits,
    required this.thisMonthVisits,
    required this.streak,
    required this.visitDates,
  });
}

class ProfileRepository {
  ProfileRepository(this._dio);
  final Dio _dio;

  Future<List<AttendanceRecord>> getAttendance(int memberId, {int perPage = 100}) async {
    try {
      final res = await _dio.get('/members/$memberId/attendance',
          queryParameters: {'per_page': perPage, 'sort': 'desc'});
      final body = res.data as Map? ?? {};
      final data = body['data'] as Map? ?? body;
      final list = data['attendance'] as List? ??
          data['records']    as List? ??
          (body['data'] is List ? body['data'] as List : []);
      return list.map((r) => AttendanceRecord.fromJson(r as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<PaymentRecord>> getPayments(int memberId) async {
    try {
      final res = await _dio.get('/members/$memberId/payments',
          queryParameters: {'per_page': 50, 'sort': 'desc'});
      final body = res.data as Map? ?? {};
      final data = body['data'] as Map? ?? body;
      final list = data['payments'] as List? ??
          (body['data'] is List ? body['data'] as List : []);
      return list.map((p) => PaymentRecord.fromJson(p as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<MemberStats> getStats(int memberId) async {
    final records = await getAttendance(memberId);
    final now   = DateTime.now();
    final month = now.month;
    final year  = now.year;

    final visitDates = records.map((r) => r.date).toSet();
    final thisMonth  = records.where((r) {
      try {
        final d = DateTime.parse(r.date);
        return d.month == month && d.year == year;
      } catch (_) {
        return false;
      }
    }).length;

    // Calculate current streak (consecutive days ending today or yesterday)
    int streak = 0;
    var checkDay = DateTime(now.year, now.month, now.day);
    while (true) {
      final ds = '${checkDay.year}-${checkDay.month.toString().padLeft(2,'0')}-${checkDay.day.toString().padLeft(2,'0')}';
      if (visitDates.contains(ds)) {
        streak++;
        checkDay = checkDay.subtract(const Duration(days: 1));
      } else {
        break;
      }
    }

    return MemberStats(
      totalVisits:     records.length,
      thisMonthVisits: thisMonth,
      streak:          streak,
      visitDates:      visitDates,
    );
  }
}

final profileRepoProvider = Provider((ref) => ProfileRepository(ref.read(dioProvider)));

final memberStatsProvider = FutureProvider.autoDispose
    .family<MemberStats, int>((ref, memberId) =>
        ref.read(profileRepoProvider).getStats(memberId));

final attendanceProvider = FutureProvider.autoDispose
    .family<List<AttendanceRecord>, int>((ref, memberId) =>
        ref.read(profileRepoProvider).getAttendance(memberId));

final paymentsProvider = FutureProvider.autoDispose
    .family<List<PaymentRecord>, int>((ref, memberId) =>
        ref.read(profileRepoProvider).getPayments(memberId));

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/utils/formatters.dart';

class Payment {
  final int    id;
  final String memberName;
  final String memberCode;
  final String plan;
  final num    amount;
  final String status;   // completed | pending | overdue | failed
  final String method;
  final String? paidAt;
  final String? createdAt;

  const Payment({
    required this.id,
    required this.memberName,
    required this.memberCode,
    required this.plan,
    required this.amount,
    required this.status,
    required this.method,
    this.paidAt,
    this.createdAt,
  });

  factory Payment.fromJson(Map<String, dynamic> j) {
    final m = j['member'] as Map? ?? {};
    final u = m['user']   as Map? ?? {};
    final sub = j['subscription'] as Map? ?? {};
    final plan = sub['plan'] as Map? ?? {};
    return Payment(
      id:         j['id'] as int,
      memberName: '${u['first_name'] ?? ''} ${u['last_name'] ?? ''}'.trim(),
      memberCode: m['member_code'] as String? ?? '',
      plan:       plan['name']     as String? ?? 'Membership',
      amount:     j['amount']      as num? ?? 0,
      status:     j['status']      as String? ?? 'pending',
      method:     j['payment_method'] as String? ?? '—',
      paidAt:     j['paid_at']     as String?,
      createdAt:  j['created_at']  as String?,
    );
  }

  String get displayDate => formatDate(paidAt ?? createdAt);

  bool get isPaid     => status == 'completed' || status == 'paid';
  bool get isPending  => status == 'pending';
  bool get isOverdue  => status == 'overdue';
  bool get isFailed   => status == 'failed';
}

class PaymentsRepository {
  PaymentsRepository(this._dio);
  final Dio _dio;

  Future<({List<Payment> payments, int total})> list({
    String? status,
    int page    = 1,
    int perPage = 30,
  }) async {
    final res = await _dio.get('/payments', queryParameters: {
      'facility_id': 1,
      'per_page': perPage,
      'page': page,
      if (status != null && status != 'all') 'status': status,
    });
    final body = res.data['data'] as Map? ?? {};
    final list = (body['payments'] as List? ?? [])
        .map((p) => Payment.fromJson(p as Map<String, dynamic>))
        .toList();
    final total = body['meta']?['total'] as int? ?? list.length;
    return (payments: list, total: total);
  }
}

final paymentsRepoProvider = Provider<PaymentsRepository>(
    (ref) => PaymentsRepository(ref.read(dioProvider)));

final paymentsProvider = FutureProvider.autoDispose.family<
    ({List<Payment> payments, int total}), String>((ref, status) {
  return ref.read(paymentsRepoProvider).list(
        status: status == 'all' ? null : status,
        perPage: 50,
      );
});

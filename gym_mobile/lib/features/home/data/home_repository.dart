import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';

// A single class booking as shown on the home screen
class UpcomingBooking {
  final int id;
  final String className;
  final String trainerName;
  final String classDate;
  final String startTime;
  final String endTime;
  final String status;

  const UpcomingBooking({
    required this.id,
    required this.className,
    required this.trainerName,
    required this.classDate,
    required this.startTime,
    required this.endTime,
    required this.status,
  });

  factory UpcomingBooking.fromJson(Map<String, dynamic> j) {
    final cls     = j['class_session'] as Map? ?? j['class'] as Map? ?? {};
    final trainer = cls['trainer'] as Map? ?? {};
    final trainerUser = trainer['user'] as Map? ?? {};
    return UpcomingBooking(
      id:          j['id'] as int,
      className:   cls['name'] as String? ?? cls['class_name'] as String? ?? 'Class',
      trainerName: '${trainerUser['first_name'] ?? ''} ${trainerUser['last_name'] ?? ''}'.trim(),
      classDate:   cls['date'] as String? ?? cls['class_date'] as String? ?? '',
      startTime:   cls['start_time'] as String? ?? '',
      endTime:     cls['end_time'] as String? ?? '',
      status:      j['status'] as String? ?? 'booked',
    );
  }
}

class HomeRepository {
  HomeRepository(this._dio);
  final Dio _dio;

  Future<List<UpcomingBooking>> getUpcomingBookings(int memberId) async {
    try {
      final today = _dateStr(DateTime.now());
      final res = await _dio.get('/bookings', queryParameters: {
        'member_id': memberId,
        'from_date': today,
        'status': 'booked',
        'per_page': 5,
      });
      final body = res.data['data'] as Map? ?? res.data as Map? ?? {};
      final list = body['bookings'] as List? ?? [];
      return list
          .map((b) => UpcomingBooking.fromJson(b as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  String _dateStr(DateTime dt) =>
      '${dt.year}-${dt.month.toString().padLeft(2,'0')}-${dt.day.toString().padLeft(2,'0')}';
}

final homeRepoProvider = Provider((ref) => HomeRepository(ref.read(dioProvider)));

final upcomingBookingsProvider = FutureProvider.autoDispose
    .family<List<UpcomingBooking>, int>((ref, memberId) =>
        ref.read(homeRepoProvider).getUpcomingBookings(memberId));

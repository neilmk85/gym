import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

class GymClass {
  final int id;
  final String name;
  final String category;
  final String date;
  final String startTime;
  final String endTime;
  final int durationMinutes;
  final String trainerName;
  final int capacity;
  final int bookedCount;
  int? myBookingId; // non-null if the logged-in member has booked this

  GymClass({
    required this.id,
    required this.name,
    required this.category,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.durationMinutes,
    required this.trainerName,
    required this.capacity,
    required this.bookedCount,
    this.myBookingId,
  });

  bool get isBooked => myBookingId != null;
  bool get isFull => bookedCount >= capacity;

  factory GymClass.fromJson(Map<String, dynamic> j) {
    final trainer = j['trainer'] as Map? ?? {};
    final trainerUser = trainer['user'] as Map? ?? {};
    final firstName = trainerUser['first_name'] as String? ?? '';
    final lastName  = trainerUser['last_name']  as String? ?? '';
    final trainerName = '$firstName $lastName'.trim();

    final start = j['start_time'] as String? ?? '';
    final end   = j['end_time']   as String? ?? '';
    int duration = 60;
    try {
      final s = DateTime.parse('2000-01-01T$start');
      final e = DateTime.parse('2000-01-01T$end');
      duration = e.difference(s).inMinutes;
    } catch (_) {}

    return GymClass(
      id:              j['id'] as int,
      name:            j['name'] as String? ?? j['class_name'] as String? ?? 'Class',
      category:        j['category'] as String? ?? j['type'] as String? ?? 'General',
      date:            j['date'] as String? ?? j['class_date'] as String? ?? '',
      startTime:       start,
      endTime:         end,
      durationMinutes: duration,
      trainerName:     trainerName.isEmpty ? 'Staff' : trainerName,
      capacity:        j['capacity'] as int? ?? 20,
      bookedCount:     j['booked_count'] as int? ?? j['bookings_count'] as int? ?? 0,
    );
  }
}

class MemberBooking {
  final int id;
  final int classId;
  final String status;

  const MemberBooking({required this.id, required this.classId, required this.status});

  factory MemberBooking.fromJson(Map<String, dynamic> j) {
    final cls = j['class_session'] as Map? ?? j['class'] as Map? ?? {};
    return MemberBooking(
      id:      j['id'] as int,
      classId: cls['id'] as int? ?? 0,
      status:  j['status'] as String? ?? 'booked',
    );
  }
}

class ClassesRepository {
  ClassesRepository(this._dio);
  final Dio _dio;

  Future<List<GymClass>> getClasses(String date) async {
    try {
      final res = await _dio.get('/classes', queryParameters: {
        'date': date,
        'per_page': 50,
      });
      final body = res.data as Map? ?? {};
      final data = body['data'] as Map? ?? body;
      final list = data['classes'] as List? ?? data['items'] as List? ?? (body['data'] is List ? body['data'] as List : []);
      return list.map((c) => GymClass.fromJson(c as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<MemberBooking>> getMyBookings(int memberId, {String? fromDate, String? toDate}) async {
    try {
      final res = await _dio.get('/bookings', queryParameters: {
        'member_id': memberId,
        if (fromDate != null) 'from_date': fromDate,
        if (toDate != null) 'to_date': toDate,
        'status': 'booked',
        'per_page': 100,
      });
      final body = res.data as Map? ?? {};
      final data = body['data'] as Map? ?? body;
      final list = data['bookings'] as List? ?? (body['data'] is List ? body['data'] as List : []);
      return list.map((b) => MemberBooking.fromJson(b as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<int?> bookClass(int classId) async {
    try {
      final res = await _dio.post('/bookings', data: {'class_session_id': classId});
      final data = res.data['data'] as Map? ?? res.data as Map? ?? {};
      final booking = data['booking'] as Map? ?? data;
      return booking['id'] as int?;
    } catch (_) {
      return null;
    }
  }

  Future<bool> cancelBooking(int bookingId) async {
    try {
      await _dio.delete('/bookings/$bookingId');
      return true;
    } catch (_) {
      return false;
    }
  }
}

final classesRepoProvider = Provider((ref) => ClassesRepository(ref.read(dioProvider)));

final classesProvider = FutureProvider.autoDispose
    .family<List<GymClass>, String>((ref, date) =>
        ref.read(classesRepoProvider).getClasses(date));

final myBookingsProvider = FutureProvider.autoDispose
    .family<List<MemberBooking>, int>((ref, memberId) =>
        ref.read(classesRepoProvider).getMyBookings(memberId));

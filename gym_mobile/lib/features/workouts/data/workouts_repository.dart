import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

class WorkoutExercise {
  final String name;
  final int sets;
  final int reps;
  final String? weight;
  final String? notes;
  final int order;

  const WorkoutExercise({
    required this.name,
    required this.sets,
    required this.reps,
    this.weight,
    this.notes,
    required this.order,
  });

  factory WorkoutExercise.fromJson(Map<String, dynamic> j) {
    final exercise = j['exercise'] as Map? ?? j;
    return WorkoutExercise(
      name:   exercise['name'] as String? ?? j['name'] as String? ?? 'Exercise',
      sets:   j['sets'] as int? ?? 3,
      reps:   j['reps'] as int? ?? 10,
      weight: j['weight']?.toString(),
      notes:  j['notes'] as String?,
      order:  j['order'] as int? ?? 0,
    );
  }
}

class WorkoutDay {
  final String dayOfWeek; // Monday, Tuesday, ...
  final String? focus;
  final List<WorkoutExercise> exercises;

  const WorkoutDay({
    required this.dayOfWeek,
    this.focus,
    required this.exercises,
  });

  factory WorkoutDay.fromJson(Map<String, dynamic> j) {
    final exerciseList = j['exercises'] as List? ?? [];
    return WorkoutDay(
      dayOfWeek: j['day_of_week'] as String? ?? j['day'] as String? ?? '',
      focus:     j['focus'] as String? ?? j['muscle_group'] as String?,
      exercises: exerciseList
          .map((e) => WorkoutExercise.fromJson(e as Map<String, dynamic>))
          .toList()
        ..sort((a, b) => a.order.compareTo(b.order)),
    );
  }
}

class WorkoutPlan {
  final int id;
  final String name;
  final String? trainerName;
  final String? notes;
  final List<WorkoutDay> days;

  const WorkoutPlan({
    required this.id,
    required this.name,
    this.trainerName,
    this.notes,
    required this.days,
  });

  factory WorkoutPlan.fromJson(Map<String, dynamic> j) {
    final trainer = j['trainer'] as Map? ?? {};
    final trainerUser = trainer['user'] as Map? ?? {};
    final trainerName = '${trainerUser['first_name'] ?? ''} ${trainerUser['last_name'] ?? ''}'.trim();
    final dayList = j['days'] as List? ?? j['workout_days'] as List? ?? [];

    return WorkoutPlan(
      id:          j['id'] as int,
      name:        j['name'] as String? ?? 'My Workout Plan',
      trainerName: trainerName.isEmpty ? null : trainerName,
      notes:       j['notes'] as String?,
      days: dayList
          .map((d) => WorkoutDay.fromJson(d as Map<String, dynamic>))
          .toList(),
    );
  }
}

class WorkoutsRepository {
  WorkoutsRepository(this._dio);
  final Dio _dio;

  Future<WorkoutPlan?> getWorkoutPlan(int memberId) async {
    try {
      final res = await _dio.get('/members/$memberId/workout-assignments');
      final body = res.data as Map? ?? {};
      final data = body['data'] as Map? ?? body;
      final assignment = data['assignment'] as Map? ?? data['workout_assignment'] as Map? ?? data;
      if (assignment.isEmpty) return null;
      return WorkoutPlan.fromJson(Map<String, dynamic>.from(assignment));
    } catch (_) {
      return null;
    }
  }
}

final workoutsRepoProvider = Provider((ref) => WorkoutsRepository(ref.read(dioProvider)));

final workoutPlanProvider = FutureProvider.autoDispose
    .family<WorkoutPlan?, int>((ref, memberId) =>
        ref.read(workoutsRepoProvider).getWorkoutPlan(memberId));

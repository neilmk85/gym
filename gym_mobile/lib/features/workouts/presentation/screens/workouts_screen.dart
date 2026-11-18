import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/workouts_repository.dart';

class WorkoutsScreen extends ConsumerWidget {
  const WorkoutsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile  = ref.watch(memberProfileProvider);
    final memberId = profile?.id ?? ref.watch(authUserProvider).valueOrNull?.id ?? 0;
    final planAsync = ref.watch(workoutPlanProvider(memberId));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: planAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error:   (_, __) => const Center(
              child: Text('Could not load workout plan', style: TextStyle(color: AppColors.textMuted))),
          data: (plan) => plan == null
              ? _EmptyPlan()
              : _PlanView(plan: plan),
        ),
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────
class _EmptyPlan extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Workouts',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 48),
          Center(
            child: Column(
              children: [
                Container(
                  width: 80, height: 80,
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.fitness_center, color: AppColors.textMuted, size: 36),
                ),
                const SizedBox(height: 20),
                const Text('No workout plan assigned',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                const SizedBox(height: 8),
                const Text('Your trainer will assign a plan to you soon.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Plan view ─────────────────────────────────────────────────────────────────
class _PlanView extends StatelessWidget {
  const _PlanView({required this.plan});
  final WorkoutPlan plan;

  static const _dayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  @override
  Widget build(BuildContext context) {
    final sortedDays = [...plan.days]..sort((a, b) {
      final ai = _dayOrder.indexOf(a.dayOfWeek);
      final bi = _dayOrder.indexOf(b.dayOfWeek);
      return ai.compareTo(bi);
    });

    final today = _dayOrder[DateTime.now().weekday - 1];

    return CustomScrollView(
      slivers: [
        // Header
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('My Workout Plan',
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(height: 6),
                Text(plan.name,
                    style: const TextStyle(fontSize: 15, color: AppColors.textSecondary)),
                if (plan.trainerName != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.person_outline, size: 14, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Text('Assigned by ${plan.trainerName}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),

        // Plan notes
        if (plan.notes != null && plan.notes!.isNotEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline, size: 16, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(plan.notes!,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                    ),
                  ],
                ),
              ),
            ),
          ),

        // Day cards
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 40),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, i) => _DayCard(day: sortedDays[i], isToday: sortedDays[i].dayOfWeek == today),
              childCount: sortedDays.length,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Day card ──────────────────────────────────────────────────────────────────
class _DayCard extends StatefulWidget {
  const _DayCard({required this.day, required this.isToday});
  final WorkoutDay day;
  final bool isToday;

  @override
  State<_DayCard> createState() => _DayCardState();
}

class _DayCardState extends State<_DayCard> {
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.isToday;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => setState(() => _expanded = !_expanded),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: widget.isToday ? AppColors.primary.withOpacity(0.4) : AppColors.divider,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: widget.isToday
                          ? AppColors.primary
                          : AppColors.cardElevated,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text(
                        widget.day.dayOfWeek.substring(0, 3).toUpperCase(),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: widget.isToday ? Colors.black : AppColors.textMuted,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(widget.day.dayOfWeek,
                                style: const TextStyle(
                                    fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                            if (widget.isToday) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: const Text('Today',
                                    style: TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.w700)),
                              ),
                            ],
                          ],
                        ),
                        if (widget.day.focus != null)
                          Text(widget.day.focus!,
                              style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      Text('${widget.day.exercises.length} exercises',
                          style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                      const SizedBox(width: 6),
                      Icon(
                        _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                        color: AppColors.textMuted,
                        size: 20,
                      ),
                    ],
                  ),
                ],
              ),
            ),

            if (_expanded && widget.day.exercises.isNotEmpty) ...[
              const Divider(color: AppColors.divider, height: 1),
              ...widget.day.exercises.map((ex) => _ExerciseTile(exercise: ex)),
              const SizedBox(height: 8),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Exercise tile ─────────────────────────────────────────────────────────────
class _ExerciseTile extends StatelessWidget {
  const _ExerciseTile({required this.exercise});
  final WorkoutExercise exercise;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Icon(Icons.fitness_center, size: 14, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(exercise.name,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text('${exercise.sets} sets × ${exercise.reps} reps',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    if (exercise.weight != null && exercise.weight!.isNotEmpty) ...[
                      const Text(' · ', style: TextStyle(color: AppColors.textMuted)),
                      Text(exercise.weight!,
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    ],
                  ],
                ),
                if (exercise.notes != null && exercise.notes!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(exercise.notes!,
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontStyle: FontStyle.italic)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

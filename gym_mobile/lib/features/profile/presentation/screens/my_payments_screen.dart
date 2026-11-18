import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import 'profile_repository.dart';

class MyPaymentsScreen extends ConsumerWidget {
  const MyPaymentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile  = ref.watch(memberProfileProvider);
    final memberId = profile?.id ?? ref.watch(authUserProvider).valueOrNull?.id ?? 0;
    final async    = ref.watch(paymentsProvider(memberId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Payment History'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => context.pop(),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error:   (_, __) => const Center(
            child: Text('Could not load payments', style: TextStyle(color: AppColors.textMuted))),
        data: (payments) {
          if (payments.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.receipt_long_outlined, color: AppColors.textMuted, size: 48),
                  const SizedBox(height: 12),
                  const Text('No payment records yet',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 16)),
                ],
              ),
            );
          }

          final totalPaid = payments
              .where((p) => p.status.toLowerCase() == 'paid' || p.status.toLowerCase() == 'completed')
              .fold<double>(0, (sum, p) => sum + p.amount);

          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
            children: [
              // Total summary
              Container(
                padding: const EdgeInsets.all(20),
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.gradientStart, AppColors.gradientEnd],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Total Paid',
                              style: TextStyle(color: Colors.white70, fontSize: 13)),
                          const SizedBox(height: 4),
                          Text(
                            NumberFormat.currency(symbol: '₹', decimalDigits: 0).format(totalPaid),
                            style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                    ),
                    Text('${payments.length} payments',
                        style: const TextStyle(color: Colors.white70, fontSize: 13)),
                  ],
                ),
              ),

              // Payment list
              ...payments.map((p) => _PaymentTile(payment: p)),
            ],
          );
        },
      ),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  const _PaymentTile({required this.payment});
  final PaymentRecord payment;

  @override
  Widget build(BuildContext context) {
    String dateLabel = payment.date;
    try {
      final dt = DateTime.parse(payment.date);
      dateLabel = DateFormat('MMM d, y').format(dt);
    } catch (_) {}

    final isPaid = payment.status.toLowerCase() == 'paid' ||
                   payment.status.toLowerCase() == 'completed';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: isPaid
                  ? AppColors.success.withOpacity(0.1)
                  : AppColors.warning.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isPaid ? Icons.check_circle_outline : Icons.pending_outlined,
              color: isPaid ? AppColors.success : AppColors.warning,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(payment.planName ?? 'Membership Payment',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(dateLabel,
                        style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                    if (payment.method != null && payment.method!.isNotEmpty) ...[
                      const Text(' · ', style: TextStyle(color: AppColors.textMuted)),
                      Text(payment.method!,
                          style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                NumberFormat.currency(symbol: '₹', decimalDigits: 0).format(payment.amount),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 2),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: isPaid
                      ? AppColors.success.withOpacity(0.12)
                      : AppColors.warning.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  payment.status.toUpperCase(),
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: isPaid ? AppColors.success : AppColors.warning,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

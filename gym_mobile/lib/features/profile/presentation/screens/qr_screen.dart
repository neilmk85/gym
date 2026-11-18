import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class QRScreen extends ConsumerWidget {
  const QRScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState  = ref.watch(authUserProvider);
    final profile    = ref.watch(memberProfileProvider);
    final user       = authState.valueOrNull;
    final fullName   = user?.fullName ?? 'Member';
    final memberCode = profile?.memberCode ?? user?.id.toString() ?? '0';
    final planName   = profile?.planName ?? 'Standard Plan';
    final status     = profile?.status ?? 'active';

    // QR data: encode member code for the gym scanner
    final qrData = memberCode;

    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar ──────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textSecondary),
                    onPressed: () => context.pop(),
                  ),
                  const Expanded(
                    child: Text('Check-in Pass',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                  ),
                  const SizedBox(width: 48),
                ],
              ),
            ),

            const Spacer(),

            // ── QR Card (Ladder-style dark gradient) ─────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0A1628), Color(0xFF0F2544)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: AppColors.primary.withOpacity(0.3), width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.2),
                      blurRadius: 40,
                      spreadRadius: 2,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // Brand
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 28, height: 28,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppColors.gradientStart, AppColors.gradientEnd],
                            ),
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: const Icon(Icons.fitness_center, color: Colors.white, size: 14),
                        ),
                        const SizedBox(width: 8),
                        const Text('StayFit',
                            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                      ],
                    ),
                    const SizedBox(height: 28),

                    // QR code with glow
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withOpacity(0.4),
                            blurRadius: 32,
                            spreadRadius: 4,
                          ),
                        ],
                      ),
                      child: QrImageView(
                        data: qrData,
                        version: QrVersions.auto,
                        size: 180,
                        backgroundColor: Colors.white,
                        eyeStyle: const QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: Colors.black,
                        ),
                        dataModuleStyle: const QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: Colors.black,
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),

                    // Member info
                    Text(fullName,
                        style: const TextStyle(
                            color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text(memberCode,
                        style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 2,
                            fontFamily: 'monospace')),
                    const SizedBox(height: 6),
                    Text(planName,
                        style: const TextStyle(color: Colors.white54, fontSize: 12)),
                    const SizedBox(height: 16),

                    // Status chip
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      decoration: BoxDecoration(
                        color: status.toLowerCase() == 'active'
                            ? AppColors.success.withOpacity(0.15)
                            : AppColors.error.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: status.toLowerCase() == 'active'
                              ? AppColors.success.withOpacity(0.4)
                              : AppColors.error.withOpacity(0.4),
                        ),
                      ),
                      child: Text(
                        status.toLowerCase() == 'active' ? '● ACTIVE MEMBER' : '● ${status.toUpperCase()}',
                        style: TextStyle(
                          color: status.toLowerCase() == 'active' ? AppColors.success : AppColors.error,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const Spacer(),

            // ── Instruction ──────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(32, 0, 32, 32),
              child: Text(
                'Show this QR code at the front desk to check in',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.textMuted),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

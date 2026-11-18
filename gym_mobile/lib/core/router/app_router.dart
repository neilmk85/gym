import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/classes/presentation/screens/classes_screen.dart';
import '../../features/workouts/presentation/screens/workouts_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/profile/presentation/screens/qr_screen.dart';
import '../../features/profile/presentation/screens/my_attendance_screen.dart';
import '../../features/profile/presentation/screens/my_payments_screen.dart';
import '../widgets/main_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(authUserProvider.notifier);

  return GoRouter(
    initialLocation: '/home',
    redirect: (context, state) {
      final authState = ref.read(authUserProvider);
      if (authState.isLoading) return null;
      final isLoggedIn = authState.valueOrNull != null;
      final isLoginRoute = state.matchedLocation == '/login';
      if (!isLoggedIn && !isLoginRoute) return '/login';
      if (isLoggedIn && isLoginRoute) return '/home';
      return null;
    },
    refreshListenable: GoRouterRefreshStream(authNotifier.stream),
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),

      // Full-screen routes (no bottom nav)
      GoRoute(path: '/qr',         builder: (_, __) => const QRScreen()),
      GoRoute(path: '/attendance', builder: (_, __) => const MyAttendanceScreen()),
      GoRoute(path: '/payments',   builder: (_, __) => const MyPaymentsScreen()),

      // Main shell with bottom nav
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(path: '/home',     builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/classes',  builder: (_, __) => const ClassesScreen()),
          GoRoute(path: '/workouts', builder: (_, __) => const WorkoutsScreen()),
          GoRoute(path: '/profile',  builder: (_, __) => const ProfileScreen()),
        ],
      ),
    ],
  );
});

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    _sub = stream.listen((_) => notifyListeners());
  }
  late final StreamSubscription<dynamic> _sub;
  @override
  void dispose() { _sub.cancel(); super.dispose(); }
}

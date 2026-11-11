import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/dashboard/presentation/screens/dashboard_screen.dart';
import '../../features/members/presentation/screens/members_screen.dart';
import '../../features/members/presentation/screens/member_detail_screen.dart';
import '../../features/attendance/presentation/screens/attendance_screen.dart';
import '../../features/pt_sessions/presentation/screens/pt_sessions_screen.dart';
import '../../features/payments/presentation/screens/payments_screen.dart';
import '../widgets/main_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(authUserProvider.notifier);

  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (context, state) {
      final isLoggedIn = ref.read(authUserProvider).valueOrNull != null;
      if (isLoggedIn && state.matchedLocation == '/login') return '/dashboard';
      return null;
    },
    refreshListenable: GoRouterRefreshStream(authNotifier.stream),
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(path: '/dashboard',   builder: (_, __) => const DashboardScreen()),
          GoRoute(
            path: '/members',
            builder: (_, state) => MembersScreen(
              initialTab: state.uri.queryParameters['tab'] == 'renewals' ? 1 : 0,
            ),
          ),
          GoRoute(
            path: '/members/:id',
            builder: (_, state) => MemberDetailScreen(memberId: int.parse(state.pathParameters['id']!)),
          ),
          GoRoute(path: '/attendance',  builder: (_, __) => const AttendanceScreen()),
          GoRoute(path: '/pt-sessions', builder: (_, __) => const PTSessionsScreen()),
          GoRoute(
            path: '/payments',
            builder: (_, state) => PaymentsScreen(
              initialStatus: state.uri.queryParameters['status'],
            ),
          ),
        ],
      ),
    ],
  );
});

// Bridges Riverpod StateNotifier stream to GoRouter's Listenable
class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    _sub = stream.listen((_) => notifyListeners());
  }
  late final _sub;
  @override
  void dispose() { _sub.cancel(); super.dispose(); }
}

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/auth_repository.dart';
import '../../domain/auth_models.dart';
import '../../../dashboard/data/dashboard_repository.dart';

// Holds the currently logged-in user (null = not logged in)
final authUserProvider = StateNotifierProvider<AuthNotifier, AsyncValue<AuthUser?>>((ref) {
  return AuthNotifier(ref, ref.read(authRepositoryProvider));
});

class AuthNotifier extends StateNotifier<AsyncValue<AuthUser?>> {
  AuthNotifier(this._ref, this._repo) : super(const AsyncValue.loading()) {
    _init();
  }
  final Ref _ref;
  final AuthRepository _repo;

  Future<void> _init() async {
    try {
      final user = await _repo.restoreSession();
      if (user != null) {
        state = AsyncValue.data(user);
        return;
      }
    } catch (_) {}
    // Auto-login: login page is hidden
    try {
      await login('admin@gymapp.com', 'Admin@123456');
    } catch (e, s) {
      state = AsyncValue.error(e, s);
    }
  }

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final user = await _repo.login(email, password);
      // Invalidate dashboard so it refetches with the new token
      _ref.invalidate(dashboardStatsProvider);
      _ref.invalidate(expiringMembersProvider);
      state = AsyncValue.data(user);
    } catch (e, s) {
      state = AsyncValue.error(e, s);
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    state = const AsyncValue.data(null);
  }
}

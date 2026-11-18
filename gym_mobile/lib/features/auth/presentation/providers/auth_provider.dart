import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/auth_repository.dart';
import '../../domain/auth_models.dart';

// Logged-in AuthUser (null = not logged in)
final authUserProvider = StateNotifierProvider<AuthNotifier, AsyncValue<AuthUser?>>((ref) {
  return AuthNotifier(ref, ref.read(authRepositoryProvider));
});

// Member profile (loaded after login for member-role users)
final memberProfileProvider = StateProvider<MemberProfile?>((ref) => null);

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
        await _loadMemberProfile();
        return;
      }
    } catch (_) {}
    state = const AsyncValue.data(null);
  }

  Future<void> _loadMemberProfile() async {
    try {
      final profile = await _repo.getMemberProfile();
      _ref.read(memberProfileProvider.notifier).state = profile;
    } catch (_) {}
  }

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final user = await _repo.login(email, password);
      state = AsyncValue.data(user);
      await _loadMemberProfile();
    } catch (e, s) {
      state = AsyncValue.error(e, s);
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    _ref.read(memberProfileProvider.notifier).state = null;
    state = const AsyncValue.data(null);
  }
}

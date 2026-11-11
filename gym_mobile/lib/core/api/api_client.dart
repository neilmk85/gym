import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const _baseUrl = 'https://stayfit.tvaksa.com/api/v1';

const _storage = FlutterSecureStorage();

// In-memory token cache — always up-to-date within a session.
// flutter_secure_storage is used only for session restoration on startup.
String? _memAccessToken;
String? _memRefreshToken;

Future<void> saveTokens(String access, String refresh) async {
  _memAccessToken  = access;
  _memRefreshToken = refresh;
  try {
    await Future.wait([
      _storage.write(key: 'access_token',  value: access),
      _storage.write(key: 'refresh_token', value: refresh),
    ]);
  } catch (_) {
    // Storage write failed on web — in-memory cache is still valid for this session
  }
}

Future<String?> readAccessToken() async {
  if (_memAccessToken != null) return _memAccessToken;
  try { _memAccessToken = await _storage.read(key: 'access_token'); } catch (_) {}
  return _memAccessToken;
}

Future<String?> readRefreshToken() async {
  if (_memRefreshToken != null) return _memRefreshToken;
  try { _memRefreshToken = await _storage.read(key: 'refresh_token'); } catch (_) {}
  return _memRefreshToken;
}

Future<void> clearTokens() async {
  _memAccessToken  = null;
  _memRefreshToken = null;
  try { await _storage.deleteAll(); } catch (_) {}
}

Dio buildDio() {
  final dio = Dio(BaseOptions(
    baseUrl: _baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
    headers: {'Content-Type': 'application/json'},
  ));
  dio.interceptors.add(_AuthInterceptor(dio));
  return dio;
}

class _AuthInterceptor extends QueuedInterceptorsWrapper {
  _AuthInterceptor(this._dio);
  final Dio _dio;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await readAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      try {
        final refreshToken = await readRefreshToken();
        if (refreshToken == null) return handler.next(err);

        final res = await Dio(BaseOptions(baseUrl: _baseUrl))
            .post('/auth/refresh-token', data: {'refresh_token': refreshToken});
        final newAccess = res.data['data']['tokens']['access_token'] as String;
        _memAccessToken = newAccess;
        await _storage.write(key: 'access_token', value: newAccess);

        final opts = err.requestOptions;
        opts.headers['Authorization'] = 'Bearer $newAccess';
        final retry = await _dio.fetch(opts);
        return handler.resolve(retry);
      } catch (_) {
        await clearTokens();
        handler.next(err);
      }
    } else {
      handler.next(err);
    }
  }
}

final dioProvider = Provider<Dio>((ref) => buildDio());
final storageProvider = Provider<FlutterSecureStorage>((_) => _storage);

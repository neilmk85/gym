class AuthUser {
  final int id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;

  const AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
  });

  String get fullName => '$firstName $lastName'.trim();

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
    id:        j['id'] as int,
    email:     j['email'] as String,
    firstName: j['first_name'] as String? ?? '',
    lastName:  j['last_name'] as String? ?? '',
    role:      j['role'] as String? ?? 'admin',
  );
}

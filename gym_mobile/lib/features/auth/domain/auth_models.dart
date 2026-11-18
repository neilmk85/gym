class AuthUser {
  final int id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final String? phone;
  final String? photoUrl;

  const AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    this.phone,
    this.photoUrl,
  });

  String get fullName => '$firstName $lastName'.trim();

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
    id:        j['id'] as int,
    email:     j['email'] as String,
    firstName: j['first_name'] as String? ?? '',
    lastName:  j['last_name'] as String? ?? '',
    role:      j['role'] as String? ?? 'member',
    phone:     j['phone'] as String?,
    photoUrl:  j['profile_photo_url'] as String?,
  );
}

// Member profile returned by GET /api/v1/members/me
class MemberProfile {
  final int id;
  final String memberCode;
  final String status;
  final String? planName;
  final String? planType;
  final String? startDate;
  final String? endDate;
  final int? daysLeft;
  final String? photoUrl;
  final AuthUser user;

  const MemberProfile({
    required this.id,
    required this.memberCode,
    required this.status,
    required this.user,
    this.planName,
    this.planType,
    this.startDate,
    this.endDate,
    this.daysLeft,
    this.photoUrl,
  });

  factory MemberProfile.fromJson(Map<String, dynamic> j) {
    final u   = j['user'] as Map<String, dynamic>? ?? {};
    final sub = j['current_subscription'] as Map<String, dynamic>?;
    final plan = sub?['plan'] as Map<String, dynamic>?;

    final endDateStr = sub?['end_date'] as String?;
    int? daysLeft;
    if (endDateStr != null) {
      final dt = DateTime.tryParse(endDateStr)?.toLocal();
      if (dt != null) {
        final todayStart = DateTime.now();
        final todayMidnight = DateTime(todayStart.year, todayStart.month, todayStart.day);
        final endMidnight = DateTime(dt.year, dt.month, dt.day);
        daysLeft = endMidnight.difference(todayMidnight).inDays;
      }
    }

    return MemberProfile(
      id:         j['id'] as int,
      memberCode: j['member_code'] as String? ?? '',
      status:     j['membership_status'] as String? ?? j['status'] as String? ?? 'active',
      user:       AuthUser.fromJson(u),
      planName:   plan?['name'] as String?,
      planType:   plan?['type'] as String?,
      startDate:  sub?['start_date'] as String?,
      endDate:    endDateStr,
      daysLeft:   daysLeft,
      photoUrl:   u['profile_photo_url'] as String?,
    );
  }
}

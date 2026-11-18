import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';

class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.child});
  final Widget child;

  static const _tabs = [
    _Tab('/home',     Icons.home_outlined,         Icons.home,          'Home'),
    _Tab('/classes',  Icons.calendar_today_outlined, Icons.calendar_today, 'Classes'),
    _Tab('/workouts', Icons.fitness_center_outlined, Icons.fitness_center, 'Workouts'),
    _Tab('/profile',  Icons.person_outline,          Icons.person,        'Profile'),
  ];

  int _currentIndex(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    for (int i = 0; i < _tabs.length; i++) {
      if (loc.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final idx = _currentIndex(context);
    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.divider, width: 0.5)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 60,
            child: Row(
              children: List.generate(_tabs.length, (i) {
                final selected = i == idx;
                return Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => context.go(_tabs[i].path),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          selected ? _tabs[i].activeIcon : _tabs[i].icon,
                          color: selected ? AppColors.primary : AppColors.textMuted,
                          size: 22,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          _tabs[i].label,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                            color: selected ? AppColors.primary : AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}

class _Tab {
  const _Tab(this.path, this.icon, this.activeIcon, this.label);
  final String path;
  final IconData icon;
  final IconData activeIcon;
  final String label;
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';

class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.child});
  final Widget child;

  static const _tabs = [
    _Tab('/dashboard',   Icons.dashboard_outlined,     Icons.dashboard,      'Dashboard'),
    _Tab('/members',     Icons.people_outline,          Icons.people,         'Members'),
    _Tab('/payments',    Icons.payments_outlined,        Icons.payments,       'Payments'),
    _Tab('/attendance',  Icons.how_to_reg_outlined,     Icons.how_to_reg,     'Attendance'),
    _Tab('/pt-sessions', Icons.fitness_center_outlined, Icons.fitness_center, 'PT'),
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
      bottomNavigationBar: NavigationBar(
        selectedIndex: idx,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        backgroundColor: Colors.white,
        indicatorColor: AppColors.primary.withOpacity(0.12),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: _tabs.map((t) => NavigationDestination(
          icon: Icon(t.icon, color: AppColors.textMuted),
          selectedIcon: Icon(t.activeIcon, color: AppColors.primary),
          label: t.label,
        )).toList(),
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

import 'package:fieldops_mobile/app/theme/app_theme.dart';
import 'package:fieldops_mobile/features/auth/presentation/session_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Foreman-specific home screen with crew oversight capabilities.
///
/// Per Plan Section 6.11, the foreman needs:
/// - Crew attendance at a glance
/// - One-tap flag for events
/// - Crew clock-in override (with audit trail)
/// - Daily shift log entry
/// - OT approval from home screen
/// - Simplified job status update
///
/// This is a Phase 2 screen — distinct from the worker app.
class ForemanHomeScreen extends ConsumerWidget {
  const ForemanHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;

    return Scaffold(
      appBar: AppBar(
        title: const Text('FieldOps Foreman'),
        actions: [
          TextButton(
            onPressed: () =>
                ref.read(sessionControllerProvider.notifier).signOut(),
            child: const Text('Sign out'),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Crew Overview', style: textTheme.headlineMedium),
            const SizedBox(height: 12),
            Text(
              'Monitor your crew, approve OT, and submit shift reports.',
              style: textTheme.bodyLarge,
            ),
            const SizedBox(height: 24),

            // Quick action cards
            _QuickActionCard(
              icon: Icons.groups_rounded,
              title: 'Crew Attendance',
              subtitle: 'See who is clocked in, late, or absent',
              color: palette.signal,
              onTap: () {
                // TODO: Navigate to crew attendance view
              },
            ),
            const SizedBox(height: 12),
            _QuickActionCard(
              icon: Icons.more_time_rounded,
              title: 'OT Approvals',
              subtitle: 'Review and approve overtime requests',
              color: palette.success,
              onTap: () {
                // TODO: Navigate to OT approval queue
              },
            ),
            const SizedBox(height: 12),
            _QuickActionCard(
              icon: Icons.assignment_rounded,
              title: 'Daily Shift Report',
              subtitle: 'Log today\'s work summary',
              color: palette.steel,
              onTap: () {
                // TODO: Navigate to shift report form
              },
            ),
            const SizedBox(height: 12),
            _QuickActionCard(
              icon: Icons.flag_rounded,
              title: 'Flag Event',
              subtitle: 'Flag a worker event for admin review',
              color: palette.danger,
              onTap: () {
                // TODO: Navigate to event flagging
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  const _QuickActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Semantics(
      button: true,
      label: title,
      child: Card(
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(FieldOpsRadius.xxl),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(FieldOpsRadius.lg),
                  ),
                  child: Icon(icon, color: color),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: textTheme.titleLarge),
                      const SizedBox(height: 2),
                      Text(subtitle, style: textTheme.bodyMedium),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded,
                    color: context.palette.steel),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

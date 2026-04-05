import 'package:fieldops_mobile/app/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// Worker's personal history of jobs, hours, and photos.
///
/// Plan Section 6.10: "Personal record of all jobs, hours logged,
/// photos submitted. Work history accessible from home screen."
class WorkerHistoryScreen extends StatelessWidget {
  const WorkerHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Work History'),
        leading: const BackButton(),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Your work record', style: textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text(
              'All jobs, hours, and photos from your work history.',
              style: textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),

            // Stats summary cards
            Row(
              children: [
                _StatCard(
                  icon: Icons.work_rounded,
                  label: 'Jobs',
                  value: '—',
                  color: palette.signal,
                ),
                const SizedBox(width: 12),
                _StatCard(
                  icon: Icons.schedule_rounded,
                  label: 'Hours',
                  value: '—',
                  color: palette.success,
                ),
                const SizedBox(width: 12),
                _StatCard(
                  icon: Icons.camera_alt_rounded,
                  label: 'Photos',
                  value: '—',
                  color: palette.steel,
                ),
              ],
            ),
            const SizedBox(height: 24),

            // History list placeholder
            Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.history_rounded, size: 48,
                        color: palette.steel),
                    const SizedBox(height: 12),
                    Text('History loads from your clock events',
                        style: textTheme.titleLarge),
                    const SizedBox(height: 8),
                    Text(
                      'Your past jobs, total hours, and photo count will appear here.',
                      style: textTheme.bodyMedium,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 8),
              Text(value, style: textTheme.headlineMedium),
              Text(label, style: textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}

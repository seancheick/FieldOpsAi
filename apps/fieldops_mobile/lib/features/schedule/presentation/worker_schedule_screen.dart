import 'package:fieldops_mobile/app/theme/app_theme.dart';
import 'package:fieldops_mobile/l10n/app_localizations.dart';
import 'package:fieldops_mobile/features/schedule/domain/schedule_repository.dart';
import 'package:fieldops_mobile/features/schedule/domain/worker_schedule_shift.dart';
import 'package:fieldops_mobile/features/schedule/presentation/worker_schedule_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class WorkerScheduleScreen extends ConsumerWidget {
  const WorkerScheduleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final scheduleState = ref.watch(workerScheduleControllerProvider);
    final palette = Theme.of(context).extension<FieldOpsPalette>()!;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.mySchedule),
        leading: const BackButton(),
      ),
      body: RefreshIndicator(
        onRefresh: () =>
            ref.read(workerScheduleControllerProvider.notifier).reload(),
        child: scheduleState.when(
          data: (shifts) {
            if (shifts.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                children: const [
                  SizedBox(height: 140),
                  _ScheduleEmptyState(),
                ],
              );
            }

            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              itemCount: shifts.length + 1,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                if (index == 0) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l10n.upcomingShifts, style: textTheme.headlineMedium),
                      const SizedBox(height: 8),
                      Text(
                        l10n.scheduleHelp,
                        style: textTheme.bodyMedium,
                      ),
                    ],
                  );
                }
                final shift = shifts[index - 1];
                return _ScheduleCard(shift: shift, palette: palette);
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) {
            final repositoryError =
                error is ScheduleRepositoryException
                    ? error
                    : const ScheduleRepositoryException.unknown();
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              children: [
                const SizedBox(height: 140),
                _ScheduleErrorState(message: repositoryError.message),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({required this.shift, required this.palette});

  final WorkerScheduleShift shift;
  final FieldOpsPalette palette;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final dateLabel = _formatDate(shift.shiftDate);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    shift.jobName,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                if (shift.isRecentlyUpdated)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: palette.signal.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      l10n.updated,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.signal,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _ScheduleChip(
                  icon: Icons.calendar_today_rounded,
                  label: dateLabel,
                ),
                _ScheduleChip(
                  icon: Icons.schedule_rounded,
                  label: '${shift.startTime} - ${shift.endTime}',
                ),
              ],
            ),
            if ((shift.notes ?? '').trim().isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                shift.notes!,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime value) {
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${weekdays[value.weekday - 1]}, ${months[value.month - 1]} ${value.day}';
  }
}

class _ScheduleChip extends StatelessWidget {
  const _ScheduleChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16),
          const SizedBox(width: 6),
          Text(label),
        ],
      ),
    );
  }
}

class _ScheduleEmptyState extends StatelessWidget {
  const _ScheduleEmptyState();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Column(
      children: [
        Icon(Icons.event_busy_rounded, size: 48, color: Colors.black.withValues(alpha: 0.32)),
        const SizedBox(height: 12),
        Text(l10n.noScheduledShiftsYet, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Text(
          l10n.scheduleWillAppear,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }
}

class _ScheduleErrorState extends StatelessWidget {
  const _ScheduleErrorState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Column(
      children: [
        Icon(Icons.wifi_off_rounded, size: 48, color: Colors.black.withValues(alpha: 0.32)),
        const SizedBox(height: 12),
        Text(l10n.scheduleUnavailable, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }
}

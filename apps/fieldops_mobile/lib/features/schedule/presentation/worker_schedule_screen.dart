import 'package:fieldops_mobile/app/theme/app_theme.dart';
import 'package:fieldops_mobile/app/widgets/skeleton_loader.dart';
import 'package:fieldops_mobile/l10n/app_localizations.dart';
import 'package:fieldops_mobile/features/schedule/data/schedule_repository_provider.dart';
import 'package:fieldops_mobile/features/schedule/domain/schedule_repository.dart';
import 'package:fieldops_mobile/features/schedule/domain/worker_schedule_shift.dart';
import 'package:fieldops_mobile/features/schedule/presentation/widgets/schedule_calendar.dart';
import 'package:fieldops_mobile/features/schedule/presentation/worker_schedule_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class WorkerScheduleScreen extends ConsumerWidget {
  const WorkerScheduleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final scheduleState = ref.watch(workerScheduleControllerProvider);
    final palette = context.palette;
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
            // Build shift date set for calendar
            final now = DateTime.now();
            final shiftDates = shifts
                .map((s) => DateTime(
                      s.shiftDate.year,
                      s.shiftDate.month,
                      s.shiftDate.day,
                    ))
                .toSet();

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: palette.surfaceWhite,
                        borderRadius: BorderRadius.circular(
                          FieldOpsRadius.xxl,
                        ),
                        border: Border.all(color: palette.border),
                      ),
                      child: ScheduleCalendar(
                        month: now.month,
                        year: now.year,
                        shiftDates: shiftDates,
                      ),
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l10n.upcomingShifts, style: textTheme.headlineMedium),
                        const SizedBox(height: 8),
                        Text(
                          l10n.scheduleHelp,
                          style: textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  sliver: SliverReorderableList(
                    itemCount: shifts.length,
                    itemBuilder: (context, index) {
                      final shift = shifts[index];
                      return Padding(
                        key: ValueKey(shift.id),
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _ScheduleCard(shift: shift, palette: palette),
                      );
                    },
                    onReorder: (oldIndex, newIndex) {
                      ref.read(workerScheduleControllerProvider.notifier).reorderShifts(oldIndex, newIndex);
                    },
                  ),
                ),
              ],
            );
          },
          loading: () => const Padding(
            padding: EdgeInsets.all(20),
            child: SkeletonLoader(itemCount: 4),
          ),
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

class _ScheduleCard extends ConsumerWidget {
  const _ScheduleCard({required this.shift, required this.palette});

  final WorkerScheduleShift shift;
  final FieldOpsPalette palette;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
            const SizedBox(height: 12),
            Semantics(
              button: true,
              label: 'Request shift swap for ${shift.jobName} on $dateLabel',
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: palette.steel,
                    side: BorderSide(
                      color: palette.steel.withValues(alpha: 0.25),
                    ),
                    minimumSize: const Size.fromHeight(44),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(22),
                    ),
                  ),
                  onPressed: () async {
                    final confirmed = await _SwapConfirmDialog.show(
                      context,
                      jobName: shift.jobName,
                      dateLabel: dateLabel,
                    );
                    if (confirmed != true || !context.mounted) return;

                    await HapticFeedback.mediumImpact();
                    try {
                      await ref
                          .read(scheduleRepositoryProvider)
                          .requestShiftSwap(shiftId: shift.id);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Swap request submitted'),
                          ),
                        );
                      }
                    } on ScheduleRepositoryException catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(e.message)),
                        );
                      }
                    }
                  },
                  icon: const Icon(Icons.swap_horiz_rounded, size: 18),
                  label: const Text('Request Swap'),
                ),
              ),
            ),
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

class _SwapConfirmDialog extends StatelessWidget {
  const _SwapConfirmDialog({required this.jobName, required this.dateLabel});

  final String jobName;
  final String dateLabel;

  static Future<bool?> show(
    BuildContext context, {
    required String jobName,
    required String dateLabel,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (_) =>
          _SwapConfirmDialog(jobName: jobName, dateLabel: dateLabel),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return AlertDialog(
      title: const Text('Request Shift Swap'),
      content: Text(
        'Submit a swap request for $jobName on $dateLabel? '
        'Your supervisor will be notified.',
        style: textTheme.bodyMedium,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Request Swap'),
        ),
      ],
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

import 'package:fieldops_mobile/app/theme/app_theme.dart';
import 'package:fieldops_mobile/features/auth/presentation/session_controller.dart';
import 'package:fieldops_mobile/features/clock/presentation/clock_in_controller.dart';
import 'package:fieldops_mobile/features/home/presentation/widgets/clock_error_panel.dart';
import 'package:fieldops_mobile/features/home/presentation/widgets/clock_status_panel.dart';
import 'package:fieldops_mobile/features/home/presentation/widgets/job_card.dart';
import 'package:fieldops_mobile/features/home/presentation/widgets/jobs_empty_state.dart';
import 'package:fieldops_mobile/features/home/presentation/widgets/jobs_error_state.dart';
import 'package:fieldops_mobile/features/home/presentation/widgets/sync_status_bar.dart';
import 'package:fieldops_mobile/features/home/presentation/widgets/worker_hours_summary.dart';
import 'package:fieldops_mobile/features/home/domain/worker_hours_snapshot.dart';
import 'package:fieldops_mobile/features/home/presentation/worker_hours_controller.dart';
import 'package:fieldops_mobile/features/history/presentation/worker_history_screen.dart';
import 'package:fieldops_mobile/features/overtime/presentation/widgets/ot_prompt_banner.dart';
import 'package:fieldops_mobile/features/jobs/domain/job_summary.dart';
import 'package:fieldops_mobile/features/jobs/domain/jobs_repository.dart';
import 'package:fieldops_mobile/features/jobs/presentation/jobs_controller.dart';
import 'package:fieldops_mobile/features/schedule/presentation/worker_schedule_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key, this.email});

  final String? email;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final jobsState = ref.watch(jobsControllerProvider);
    final clockState = ref.watch(clockControllerProvider);
    final workerHoursState = ref.watch(workerHoursControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('FieldOps worker app'),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_month_rounded),
            tooltip: 'My schedule',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const WorkerScheduleScreen(),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.history_rounded),
            tooltip: 'Work history',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const WorkerHistoryScreen(),
              ),
            ),
          ),
          Semantics(
            button: true,
            label: 'Sign out',
            child: TextButton(
              onPressed: () =>
                  ref.read(sessionControllerProvider.notifier).signOut(),
              child: const Text('Sign out'),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          const SyncStatusBar(),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Assigned jobs', style: textTheme.headlineMedium),
                  const SizedBox(height: 12),
                  Text(
                    'Signed in as ${email ?? 'worker'}.',
                    style: textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 20),
                  ClockStatusPanel(
                    state: clockState,
                    onClockOut: clockState.isClockedIn
                        ? () => ref
                              .read(clockControllerProvider.notifier)
                              .clockOut()
                        : null,
                    onBreakToggle: clockState.isClockedIn
                        ? () {
                            if (clockState.isOnBreak) {
                              ref
                                  .read(clockControllerProvider.notifier)
                                  .endBreak();
                            } else {
                              ref
                                  .read(clockControllerProvider.notifier)
                                  .startBreak();
                            }
                          }
                        : null,
                  ),
                  if (clockState.hasError) ...[
                    const SizedBox(height: 14),
                    ClockErrorPanel(state: clockState),
                  ],
                  const SizedBox(height: 14),
                  _WorkerHoursSection(state: workerHoursState),
                  const SizedBox(height: 14),
                  const OTPromptBanner(),
                  const SizedBox(height: 6),
                  Expanded(
                    child: jobsState.when(
                      data: (jobs) => _JobsList(
                        jobs: jobs,
                        onRefresh: () async {
                          // catchError per-future so one failure doesn't
                          // cancel the other. Errors surface via each
                          // provider's AsyncValue.error state in the UI.
                          await Future.wait([
                            ref
                                .read(jobsControllerProvider.notifier)
                                .reload()
                                .catchError((_) {}),
                            ref
                                .read(workerHoursControllerProvider.notifier)
                                .reload()
                                .catchError((_) {}),
                          ]);
                        },
                        clockState: clockState,
                        onClockIn: ({required jobId, required jobName}) {
                          return ref
                              .read(clockControllerProvider.notifier)
                              .clockIn(jobId: jobId, jobName: jobName);
                        },
                      ),
                      loading: () =>
                          const Center(child: CircularProgressIndicator()),
                      error: (error, _) {
                        final repositoryError = error is JobsRepositoryException
                            ? error
                            : const JobsRepositoryException.unknown();
                        return JobsErrorState(
                          error: repositoryError,
                          onRetry: () => ref
                              .read(jobsControllerProvider.notifier)
                              .reload(),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WorkerHoursSection extends StatelessWidget {
  const _WorkerHoursSection({required this.state});

  final AsyncValue<WorkerHoursSnapshot> state;

  @override
  Widget build(BuildContext context) {
    return state.when(
      data: (summary) => WorkerHoursSummary(
        hoursToday: summary.hoursToday,
        hoursThisWeek: summary.hoursThisWeek,
        hoursThisMonth: summary.hoursThisMonth,
      ),
      loading: () => const _WorkerHoursStatusCard(message: 'Syncing'),
      error: (error, _) =>
          const _WorkerHoursStatusCard(message: 'Unavailable', isError: true),
    );
  }
}

class _WorkerHoursStatusCard extends StatelessWidget {
  const _WorkerHoursStatusCard({required this.message, this.isError = false});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final labelColor = isError ? palette.danger : palette.signal;
    return Stack(
      children: [
        const WorkerHoursSummary(),
        Positioned(
          top: 16,
          right: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: labelColor.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              message,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: labelColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _JobsList extends StatelessWidget {
  const _JobsList({
    required this.jobs,
    required this.onRefresh,
    required this.clockState,
    required this.onClockIn,
  });

  final List<JobSummary> jobs;
  final Future<void> Function() onRefresh;
  final ClockState clockState;
  final Future<void> Function({required String jobId, required String jobName})
  onClockIn;

  @override
  Widget build(BuildContext context) {
    if (jobs.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [SizedBox(height: 120), JobsEmptyState()],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: jobs.length,
        separatorBuilder: (_, __) => const SizedBox(height: 16),
        itemBuilder: (context, index) => JobCard(
          key: ValueKey(jobs[index].jobId),
          job: jobs[index],
          clockState: clockState,
          onClockIn: onClockIn,
        ),
      ),
    );
  }
}

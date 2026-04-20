import 'package:fieldops_mobile/features/clock/presentation/clock_in_controller.dart';
import 'package:fieldops_mobile/features/safety/data/safety_repository_provider.dart';
import 'package:fieldops_mobile/features/safety/domain/safety_repository.dart';
import 'package:fieldops_mobile/features/safety/presentation/safety_checklist_controller.dart';
import 'package:fieldops_mobile/features/safety/presentation/safety_checklist_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Worker-facing clock-in helper that gates the action behind the pre-shift
/// safety checklist.
///
/// Flow:
///   1. Ask the backend whether today's checklist is already complete for
///      [jobId]. On success + true, proceed straight to [ClockController.clockIn].
///   2. If not yet completed, push [SafetyChecklistScreen]. Only proceed to
///      clock-in if the screen pops `true` (successful submit). A cancel /
///      back press aborts cleanly without surfacing an error.
///   3. If the `safety.check` call itself fails (network/server), surface a
///      non-blocking warning and allow the clock-in to proceed — the product
///      owner mandated graceful degradation so a safety-function outage does
///      not block the field.
///
/// Intended to replace direct calls to
/// `ref.read(clockControllerProvider.notifier).clockIn(...)` from worker UI
/// (jobs tab card, job detail screen). Foreman crew clock-in is a separate
/// flow and is not gated here.
Future<void> guardedClockIn(
  BuildContext context,
  WidgetRef ref, {
  required String jobId,
  required String jobName,
}) async {
  final safetyRepo = ref.read(safetyRepositoryProvider);

  bool alreadyCompleted = false;
  bool checkFailed = false;
  try {
    alreadyCompleted = await safetyRepo.hasCompletedToday(jobId);
  } on SafetyRepositoryException {
    checkFailed = true;
  } on Exception {
    checkFailed = true;
  }

  if (!context.mounted) return;

  if (alreadyCompleted) {
    await ref.read(clockControllerProvider.notifier).clockIn(
          jobId: jobId,
          jobName: jobName,
        );
    return;
  }

  if (checkFailed) {
    // Non-blocking warning — let the worker proceed.
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          "Couldn't verify safety status — please complete the checklist "
          "if you haven't today.",
        ),
      ),
    );
    await ref.read(clockControllerProvider.notifier).clockIn(
          jobId: jobId,
          jobName: jobName,
        );
    return;
  }

  // Clear any stale answers from a previously cancelled attempt so the
  // worker starts with a fresh checklist.
  ref.read(safetyChecklistControllerProvider.notifier).reset();

  final submitted = await Navigator.of(context).push<bool>(
    MaterialPageRoute<bool>(
      builder: (_) => SafetyChecklistScreen(
        jobId: jobId,
        jobName: jobName,
      ),
    ),
  );

  if (submitted != true) return; // Cancelled — abort silently.
  if (!context.mounted) return;

  await ref.read(clockControllerProvider.notifier).clockIn(
        jobId: jobId,
        jobName: jobName,
      );
}

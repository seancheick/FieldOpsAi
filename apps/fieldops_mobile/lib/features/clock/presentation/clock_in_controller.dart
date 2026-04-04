import 'package:fieldops_mobile/features/clock/data/clock_repository_provider.dart';
import 'package:fieldops_mobile/features/clock/domain/clock_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final clockControllerProvider =
    NotifierProvider<ClockController, ClockState>(ClockController.new);

class ClockController extends Notifier<ClockState> {
  @override
  ClockState build() => const ClockState();

  Future<void> clockIn({
    required String jobId,
    required String jobName,
  }) async {
    state = state.copyWith(
      activeRequestJobId: jobId,
      clockError: null,
    );

    try {
      final result =
          await ref.read(clockRepositoryProvider).clockIn(jobId: jobId);
      state = state.copyWith(
        activeRequestJobId: null,
        activeJobId: jobId,
        activeJobName: jobName,
        lastOccurredAt: result.occurredAt,
      );
    } on ClockRepositoryException catch (error) {
      state = state.copyWith(
        activeRequestJobId: null,
        clockError: (title: 'Clock in failed', message: error.message),
      );
    } on Exception catch (_) {
      state = state.copyWith(
        activeRequestJobId: null,
        clockError: (title: 'Clock in failed', message: 'Clock in could not be completed right now.'),
      );
    }
  }

  Future<void> clockOut() async {
    final jobId = state.activeJobId;
    final jobName = state.activeJobName;
    if (jobId == null) return;

    state = state.copyWith(
      activeRequestJobId: jobId,
      clockError: null,
    );

    try {
      final result =
          await ref.read(clockRepositoryProvider).clockOut(jobId: jobId);
      state = state.copyWith(
        activeRequestJobId: null,
        activeJobId: null,
        activeJobName: null,
        lastOccurredAt: result.occurredAt,
        lastCompletedJobName: jobName,
      );
    } on ClockRepositoryException catch (error) {
      state = state.copyWith(
        activeRequestJobId: null,
        clockError: (title: 'Clock out failed', message: error.message),
      );
    } on Exception catch (_) {
      state = state.copyWith(
        activeRequestJobId: null,
        clockError: (title: 'Clock out failed', message: 'Clock out could not be completed right now.'),
      );
    }
  }

  Future<void> startBreak() async {
    final jobId = state.activeJobId;
    if (jobId == null) return;

    state = state.copyWith(clockError: null, isOnBreak: true);

    try {
      await ref.read(clockRepositoryProvider).breakStart(jobId: jobId);
    } on ClockRepositoryException catch (error) {
      state = state.copyWith(
        isOnBreak: false,
        clockError: (title: 'Break failed', message: error.message),
      );
    } on Exception catch (_) {
      state = state.copyWith(
        isOnBreak: false,
        clockError: (title: 'Break failed', message: 'Could not start break.'),
      );
    }
  }

  Future<void> endBreak() async {
    final jobId = state.activeJobId;
    if (jobId == null) return;

    state = state.copyWith(clockError: null);

    try {
      await ref.read(clockRepositoryProvider).breakEnd(jobId: jobId);
      state = state.copyWith(isOnBreak: false);
    } on ClockRepositoryException catch (error) {
      state = state.copyWith(
        clockError: (title: 'Break end failed', message: error.message),
      );
    } on Exception catch (_) {
      state = state.copyWith(
        clockError: (title: 'Break end failed', message: 'Could not end break.'),
      );
    }
  }
}

// Kept as alias so existing imports referencing ClockInState still compile.
typedef ClockInState = ClockState;

class ClockState {
  const ClockState({
    this.activeRequestJobId,
    this.activeJobId,
    this.activeJobName,
    this.lastOccurredAt,
    this.lastCompletedJobName,
    this.isOnBreak = false,
    this.clockError,
  });

  final String? activeRequestJobId;
  final String? activeJobId;
  final String? activeJobName;
  final DateTime? lastOccurredAt;
  final String? lastCompletedJobName;
  final bool isOnBreak;
  final ({String title, String message})? clockError;

  // Legacy accessors for widgets that read errorTitle/errorMessage
  String? get errorTitle => clockError?.title;
  String? get errorMessage => clockError?.message;

  bool get isClockedIn => activeJobId != null;
  bool isSubmitting(String jobId) => activeRequestJobId == jobId;
  bool isClockedInFor(String jobId) => activeJobId == jobId;
  bool get hasError => clockError != null;

  ClockState copyWith({
    Object? activeRequestJobId = _sentinel,
    Object? activeJobId = _sentinel,
    Object? activeJobName = _sentinel,
    Object? lastOccurredAt = _sentinel,
    Object? lastCompletedJobName = _sentinel,
    Object? isOnBreak = _sentinel,
    Object? clockError = _sentinel,
  }) {
    return ClockState(
      activeRequestJobId: activeRequestJobId == _sentinel
          ? this.activeRequestJobId
          : activeRequestJobId as String?,
      activeJobId:
          activeJobId == _sentinel ? this.activeJobId : activeJobId as String?,
      activeJobName: activeJobName == _sentinel
          ? this.activeJobName
          : activeJobName as String?,
      lastOccurredAt: lastOccurredAt == _sentinel
          ? this.lastOccurredAt
          : lastOccurredAt as DateTime?,
      lastCompletedJobName: lastCompletedJobName == _sentinel
          ? this.lastCompletedJobName
          : lastCompletedJobName as String?,
      isOnBreak:
          isOnBreak == _sentinel ? this.isOnBreak : isOnBreak as bool,
      clockError: clockError == _sentinel
          ? this.clockError
          : clockError as ({String title, String message})?,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClockState &&
          activeRequestJobId == other.activeRequestJobId &&
          activeJobId == other.activeJobId &&
          activeJobName == other.activeJobName &&
          lastOccurredAt == other.lastOccurredAt &&
          lastCompletedJobName == other.lastCompletedJobName &&
          isOnBreak == other.isOnBreak &&
          clockError == other.clockError;

  @override
  int get hashCode => Object.hash(
        activeRequestJobId,
        activeJobId,
        activeJobName,
        lastOccurredAt,
        lastCompletedJobName,
        isOnBreak,
        clockError,
      );
}

const _sentinel = Object();

import 'package:fieldops_mobile/features/schedule/domain/worker_schedule_shift.dart';

abstract class ScheduleRepository {
  Future<List<WorkerScheduleShift>> fetchMySchedule({
    DateTime? from,
    DateTime? to,
  });

  /// Requests a shift swap with another worker.
  Future<String> requestShiftSwap({
    required String shiftId,
    String? notes,
  });
}

enum ScheduleRepositoryErrorType { offline, unknown }

class ScheduleRepositoryException implements Exception {
  const ScheduleRepositoryException._({
    required this.type,
    required this.message,
  });

  const ScheduleRepositoryException.offline()
    : this._(
        type: ScheduleRepositoryErrorType.offline,
        message: 'You are offline.',
      );

  const ScheduleRepositoryException.unknown([
    String message = 'Unable to load your schedule right now.',
  ]) : this._(
         type: ScheduleRepositoryErrorType.unknown,
         message: message,
       );

  final ScheduleRepositoryErrorType type;
  final String message;
}

import 'package:fieldops_mobile/features/schedule/domain/crew_schedule_shift.dart';
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

  /// Fetches shifts for the foreman's crew (today + tomorrow).
  Future<List<CrewScheduleShift>> fetchCrewSchedule({
    DateTime? from,
    DateTime? to,
  });

  /// Saves the reordered crew schedule to the backend.
  /// Returns true on success.
  Future<bool> saveCrewReorder(List<CrewScheduleShift> shifts);
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

class ClockActionResult {
  const ClockActionResult({
    required this.eventId,
    required this.occurredAt,
  });

  final String eventId;
  final DateTime occurredAt;
}

abstract class ClockRepository {
  Future<ClockActionResult> clockIn({required String jobId});
  Future<ClockActionResult> clockOut({required String jobId});
  Future<ClockActionResult> breakStart({required String jobId});
  Future<ClockActionResult> breakEnd({required String jobId});
}

enum ClockRepositoryErrorType {
  offline,
  locationDenied,
  locationUnavailable,
  unknown,
}

class ClockRepositoryException implements Exception {
  const ClockRepositoryException._({
    required this.type,
    required this.message,
  });

  const ClockRepositoryException.offline()
    : this._(
        type: ClockRepositoryErrorType.offline,
        message: 'Connection is unavailable for clock events.',
      );

  const ClockRepositoryException.locationDenied()
    : this._(
        type: ClockRepositoryErrorType.locationDenied,
        message: 'Location permission is required before clocking in.',
      );

  const ClockRepositoryException.locationUnavailable()
    : this._(
        type: ClockRepositoryErrorType.locationUnavailable,
        message: 'Current location could not be captured.',
      );

  const ClockRepositoryException.unknown([
    String message = 'Clock in could not be completed right now.',
  ]) : this._(
         type: ClockRepositoryErrorType.unknown,
         message: message,
       );

  final ClockRepositoryErrorType type;
  final String message;
}

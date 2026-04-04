abstract class OTRepository {
  Future<String> submitRequest({
    required String jobId,
    double? totalHours,
    String? notes,
    String? photoEventId,
  });
}

enum OTRepositoryErrorType { offline, unknown }

class OTRepositoryException implements Exception {
  const OTRepositoryException._({
    required this.type,
    required this.message,
  });

  const OTRepositoryException.offline()
      : this._(
          type: OTRepositoryErrorType.offline,
          message: 'No connection available for OT request.',
        );

  const OTRepositoryException.unknown([
    String message = 'OT request could not be submitted.',
  ]) : this._(type: OTRepositoryErrorType.unknown, message: message);

  final OTRepositoryErrorType type;
  final String message;
}

abstract class PTORepository {
  Future<String> submitRequest({
    required String type,
    required DateTime startDate,
    required DateTime endDate,
    String? notes,
  });

  Future<List<PTORequest>> fetchMyRequests();

  /// Fetches PTO balance for the current worker.
  Future<PTOBalance> fetchMyBalance();

  /// Fetches PTO requests awaiting foreman approval.
  Future<List<PTORequest>> fetchPendingApprovals();

  /// Approves a PTO request.
  Future<void> approveRequest(String requestId);

  /// Denies a PTO request with optional reason.
  Future<void> denyRequest(String requestId, {String? reason});
}

/// PTO balance broken down by type.
class PTOBalance {
  const PTOBalance({
    this.vacationTotal = 0,
    this.vacationUsed = 0,
    this.sickTotal = 0,
    this.sickUsed = 0,
    this.personalTotal = 0,
    this.personalUsed = 0,
  });

  final double vacationTotal;
  final double vacationUsed;
  final double sickTotal;
  final double sickUsed;
  final double personalTotal;
  final double personalUsed;

  double get vacationRemaining => vacationTotal - vacationUsed;
  double get sickRemaining => sickTotal - sickUsed;
  double get personalRemaining => personalTotal - personalUsed;
  double get totalRemaining =>
      vacationRemaining + sickRemaining + personalRemaining;

  factory PTOBalance.fromJson(Map<String, dynamic> json) {
    return PTOBalance(
      vacationTotal: (json['vacation_total'] as num?)?.toDouble() ?? 0,
      vacationUsed: (json['vacation_used'] as num?)?.toDouble() ?? 0,
      sickTotal: (json['sick_total'] as num?)?.toDouble() ?? 0,
      sickUsed: (json['sick_used'] as num?)?.toDouble() ?? 0,
      personalTotal: (json['personal_total'] as num?)?.toDouble() ?? 0,
      personalUsed: (json['personal_used'] as num?)?.toDouble() ?? 0,
    );
  }
}

class PTORequest {
  const PTORequest({
    required this.id,
    required this.type,
    required this.startDate,
    required this.endDate,
    required this.status,
    this.workerName,
    this.notes,
    this.decidedBy,
    this.decidedAt,
  });

  factory PTORequest.fromJson(Map<String, dynamic> json) {
    return PTORequest(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? 'personal',
      startDate: DateTime.parse(json['start_date'] as String),
      endDate: DateTime.parse(json['end_date'] as String),
      status: json['status'] as String? ?? 'pending',
      workerName: json['worker_name'] as String?,
      notes: json['notes'] as String?,
      decidedBy: json['decided_by'] as String?,
      decidedAt: json['decided_at'] != null
          ? DateTime.tryParse(json['decided_at'] as String)
          : null,
    );
  }

  final String id;
  final String type; // vacation, sick, personal
  final DateTime startDate;
  final DateTime endDate;
  final String status; // pending, approved, denied
  final String? workerName; // populated in foreman approval context
  final String? notes;
  final String? decidedBy;
  final DateTime? decidedAt;

  int get dayCount => endDate.difference(startDate).inDays + 1;
  bool get isPending => status == 'pending';
}

class PTORepositoryException implements Exception {
  const PTORepositoryException(this.message);
  final String message;

  @override
  String toString() => 'PTORepositoryException: $message';
}

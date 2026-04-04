abstract class PTORepository {
  Future<String> submitRequest({
    required String type,
    required DateTime startDate,
    required DateTime endDate,
    String? notes,
  });

  Future<List<PTORequest>> fetchMyRequests();
}

class PTORequest {
  const PTORequest({
    required this.id,
    required this.type,
    required this.startDate,
    required this.endDate,
    required this.status,
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
  final String? notes;
  final String? decidedBy;
  final DateTime? decidedAt;

  int get dayCount => endDate.difference(startDate).inDays + 1;
  bool get isPending => status == 'pending';
}

class PTORepositoryException implements Exception {
  const PTORepositoryException(this.message);
  final String message;
}

import 'package:fieldops_mobile/features/pto/domain/pto_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final ptoRepositoryProvider = Provider<PTORepository>((ref) {
  return SupabasePTORepository();
});

class SupabasePTORepository implements PTORepository {
  final _functions = Supabase.instance.client.functions;

  @override
  Future<String> submitRequest({
    required String type,
    required DateTime startDate,
    required DateTime endDate,
    String? notes,
  }) async {
    final response = await _functions.invoke('pto', body: {
      'action': 'request',
      'pto_type': type,
      'start_date': _dateString(startDate),
      'end_date': _dateString(endDate),
      'notes': notes,
    });

    final data = response.data as Map<String, dynamic>;
    if (data['status'] != 'submitted') {
      throw PTORepositoryException(
        data['message'] as String? ?? 'Failed to submit PTO request',
      );
    }

    final pto = data['pto_request'] as Map<String, dynamic>;
    return pto['id'] as String;
  }

  @override
  Future<List<PTORequest>> fetchMyRequests() async {
    final response = await _functions.invoke(
      'pto',
      method: HttpMethod.get,
    );

    final data = response.data as Map<String, dynamic>;
    final requests = (data['requests'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>()
        .map(PTORequest.fromJson)
        .toList();

    return requests;
  }

  String _dateString(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

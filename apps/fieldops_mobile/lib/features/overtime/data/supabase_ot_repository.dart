import 'dart:io';

import 'package:fieldops_mobile/features/overtime/domain/ot_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

class SupabaseOTRepository implements OTRepository {
  const SupabaseOTRepository(this._client, {Uuid? uuid})
      : _uuid = uuid ?? const Uuid();

  final SupabaseClient _client;
  final Uuid _uuid;

  @override
  Future<String> submitRequest({
    required String jobId,
    double? totalHours,
    String? notes,
    String? photoEventId,
  }) async {
    try {
      final response = await _client.functions.invoke(
        'ot',
        headers: {
          'Idempotency-Key': _uuid.v4(),
          'X-Client-Version': 'fieldops-mobile',
        },
        body: {
          'action': 'request',
          'job_id': jobId,
          if (totalHours != null) 'total_hours': totalHours,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
          if (photoEventId != null) 'photo_event_id': photoEventId,
        },
      );

      final payload = response.data;
      if (payload is! Map<String, dynamic>) {
        throw const OTRepositoryException.unknown(
          'OT response was malformed.',
        );
      }

      return payload['ot_request_id'] as String? ?? '';
    } on SocketException {
      throw const OTRepositoryException.offline();
    } on FunctionException catch (error) {
      if (error.status == 0) throw const OTRepositoryException.offline();
      throw OTRepositoryException.unknown(
        'OT request failed (${error.status}).',
      );
    }
  }
}

import 'dart:async';
import 'dart:io';

import 'package:fieldops_mobile/features/clock/domain/clock_repository.dart';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

class SupabaseClockRepository implements ClockRepository {
  SupabaseClockRepository(this._client, {Uuid? uuid})
      : _uuid = uuid ?? const Uuid();

  final SupabaseClient _client;
  final Uuid _uuid;

  @override
  Future<ClockActionResult> clockIn({required String jobId}) =>
      _submitClockEvent(jobId: jobId, subtype: 'clock_in');

  @override
  Future<ClockActionResult> clockOut({required String jobId}) =>
      _submitClockEvent(jobId: jobId, subtype: 'clock_out');

  @override
  Future<ClockActionResult> breakStart({required String jobId}) =>
      _submitClockEvent(jobId: jobId, subtype: 'break_start');

  @override
  Future<ClockActionResult> breakEnd({required String jobId}) =>
      _submitClockEvent(jobId: jobId, subtype: 'break_end');

  Future<ClockActionResult> _submitClockEvent({
    required String jobId,
    required String subtype,
  }) async {
    try {
      final position = await _resolvePosition();
      final eventId = _uuid.v4();
      final occurredAt = DateTime.now().toUtc();
      final batchId = _uuid.v4();

      final response = await _client.functions.invoke(
        'sync_events',
        headers: {
          'Idempotency-Key': _uuid.v4(),
          'X-Client-Version': 'fieldops-mobile',
        },
        body: {
          'batch_id': batchId,
          'clock_events': [
            {
              'id': eventId,
              'job_id': jobId,
              'event_subtype': subtype,
              'occurred_at': occurredAt.toIso8601String(),
              'gps': {
                'lat': position.latitude,
                'lng': position.longitude,
                'accuracy_m': position.accuracy,
              },
            },
          ],
        },
      );

      final payload = response.data;
      if (payload is! Map<String, dynamic>) {
        throw const ClockRepositoryException.unknown(
          'Clock response was malformed.',
        );
      }

      final accepted =
          (payload['accepted'] as List<dynamic>? ?? const []).cast<String>();
      final duplicates =
          (payload['duplicates'] as List<dynamic>? ?? const []).cast<String>();
      final rejected = payload['rejected'] as List<dynamic>? ?? const [];

      if (accepted.contains(eventId) || duplicates.contains(eventId)) {
        return ClockActionResult(eventId: eventId, occurredAt: occurredAt);
      }

      if (rejected.isNotEmpty) {
        final firstRejected = rejected.first;
        if (firstRejected is Map<String, dynamic>) {
          final reason = firstRejected['reason'] as String? ?? 'unknown';
          switch (reason) {
            case 'invalid_geofence':
              throw const ClockRepositoryException.unknown(
                'You are outside the job geofence.',
              );
            case 'forbidden_job':
              throw const ClockRepositoryException.unknown(
                'This job is no longer assigned to you.',
              );
          }
        }
      }

      throw const ClockRepositoryException.unknown();
    } on SocketException {
      throw const ClockRepositoryException.offline();
    } on HttpException {
      throw const ClockRepositoryException.offline();
    } on TimeoutException {
      throw const ClockRepositoryException.locationUnavailable();
    } on PermissionDeniedException {
      throw const ClockRepositoryException.locationDenied();
    } on FunctionException catch (error) {
      if (error.status == 0) {
        throw const ClockRepositoryException.offline();
      }
      throw ClockRepositoryException.unknown(
        'Clock request failed (${error.status}).',
      );
    }
  }

  Future<Position> _resolvePosition() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      throw const ClockRepositoryException.locationUnavailable();
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw const ClockRepositoryException.locationDenied();
    }

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
      ),
    ).timeout(const Duration(seconds: 8));
  }
}

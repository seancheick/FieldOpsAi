import 'dart:async';
import 'dart:convert';

// ignore: unused_import — unawaited used in start()

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:fieldops_mobile/core/data/local_database.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
const _maxRetries = 5;
const _syncIntervalSeconds = 15;

class SyncEngine {
  SyncEngine({
    required this.database,
    required this.supabaseClient,
  });

  final LocalDatabase database;
  final SupabaseClient supabaseClient;
  Timer? _timer;
  bool _isSyncing = false;

  void start() {
    _timer?.cancel();
    _timer = Timer.periodic(
      const Duration(seconds: _syncIntervalSeconds),
      (_) => syncPendingEvents(),
    );
    // Also sync immediately on start.
    unawaited(syncPendingEvents().catchError(
      // ignore: avoid_print
      (Object e) => print('[FieldOps] Initial sync failed: $e'),
    ));
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> syncPendingEvents() async {
    if (_isSyncing) return;
    _isSyncing = true;

    try {
      final connectivity = await Connectivity().checkConnectivity();
      if (connectivity.contains(ConnectivityResult.none)) return;

      final events = await database.pendingEventsByAge();
      for (final event in events) {
        await _syncSingleEvent(event);
      }

      // Clean up synced events older than 1 hour
      await database.cleanSynced();
    } finally {
      _isSyncing = false;
    }
  }

  Future<void> _syncSingleEvent(PendingEvent event) async {
    try {
      final payload = jsonDecode(event.payload) as Map<String, dynamic>;

      switch (event.eventType) {
        case 'clock_event':
          await _syncClockEvent(event, payload);
        case 'photo_presign':
          await _syncPhotoPresign(event, payload);
        case 'photo_finalize':
          await _syncPhotoFinalize(event, payload);
        default:
          await database.markPermanentlyFailed(
            event.id,
            'Unknown event type: ${event.eventType}',
          );
      }
    } on Exception catch (e) {
      final newRetryCount = event.retryCount + 1;
      if (newRetryCount >= _maxRetries) {
        await database.markPermanentlyFailed(
          event.id,
          'Max retries exceeded: $e',
        );
      } else {
        await database.markFailed(event.id, '$e', newRetryCount);
      }
    }
  }

  Future<void> _syncClockEvent(
    PendingEvent event,
    Map<String, dynamic> payload,
  ) async {
    final response = await supabaseClient.functions.invoke(
      'sync_events',
      headers: {
        // Use the stable local row ID so retries replay the same request
        // rather than creating duplicate events on the server.
        'Idempotency-Key': 'local-event-${event.id}',
        'X-Client-Version': 'fieldops-mobile',
      },
      body: {
        // Stable batch_id ensures the entire request body is idempotent on retry.
        'batch_id': 'batch-${event.id}',
        'clock_events': [payload],
      },
    );

    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw Exception('Malformed sync response');
    }

    final accepted =
        (data['accepted'] as List<dynamic>? ?? const []).cast<String>();
    final duplicates =
        (data['duplicates'] as List<dynamic>? ?? const []).cast<String>();
    final eventId = payload['id'] as String;

    if (accepted.contains(eventId) || duplicates.contains(eventId)) {
      await database.markSynced(event.id);
      return;
    }

    final rejected = data['rejected'] as List<dynamic>? ?? const [];
    if (rejected.isNotEmpty) {
      final first = rejected.first;
      if (first is Map<String, dynamic>) {
        final reason = first['reason'] as String? ?? 'unknown';
        if (reason == 'forbidden_job' || reason == 'invalid_payload') {
          await database.markPermanentlyFailed(
            event.id,
            'Rejected: $reason',
          );
          return;
        }
      }
    }

    throw Exception('Clock event not accepted or duplicated');
  }

  Future<void> _syncPhotoPresign(
    PendingEvent event,
    Map<String, dynamic> payload,
  ) async {
    final response = await supabaseClient.functions.invoke(
      'media_presign',
      headers: {
        'Idempotency-Key': 'local-event-${event.id}',
        'X-Client-Version': 'fieldops-mobile',
      },
      body: payload,
    );

    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw Exception('Malformed presign response');
    }

    await database.markSynced(event.id);
  }

  Future<void> _syncPhotoFinalize(
    PendingEvent event,
    Map<String, dynamic> payload,
  ) async {
    final response = await supabaseClient.functions.invoke(
      'media_finalize',
      headers: {
        'Idempotency-Key': 'local-event-${event.id}',
        'X-Client-Version': 'fieldops-mobile',
      },
      body: payload,
    );

    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw Exception('Malformed finalize response');
    }

    await database.markSynced(event.id);
  }
}

final syncEngineProvider = Provider<SyncEngine>((ref) {
  final database = ref.watch(localDatabaseProvider);
  final engine = SyncEngine(
    database: database,
    supabaseClient: Supabase.instance.client,
  );
  ref.onDispose(engine.stop);
  return engine;
});

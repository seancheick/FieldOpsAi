import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

part 'local_database.g.dart';

class PendingEvents extends Table {
  TextColumn get id => text()();
  TextColumn get eventType => text()();
  TextColumn get jobId => text()();
  TextColumn get payload => text()();
  DateTimeColumn get occurredAt => dateTime()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get nextRetryAt =>
      dateTime().nullable()();
  TextColumn get syncStatus =>
      text().withDefault(const Constant('pending'))();
  TextColumn get errorMessage => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(tables: [PendingEvents])
class LocalDatabase extends _$LocalDatabase {
  LocalDatabase() : super(_openConnection());

  LocalDatabase.forTesting(super.e);

  @override
  int get schemaVersion => 1;

  Future<List<PendingEvent>> pendingEventsByAge() {
    return (select(pendingEvents)
          ..where((e) => e.syncStatus.equals('pending'))
          ..where((e) =>
              e.nextRetryAt.isNull() |
              e.nextRetryAt.isSmallerOrEqualValue(DateTime.now()))
          ..orderBy([(e) => OrderingTerm.asc(e.occurredAt)]))
        .get();
  }

  Future<int> pendingCount() async {
    final query = selectOnly(pendingEvents)
      ..addColumns([pendingEvents.id.count()])
      ..where(pendingEvents.syncStatus.equals('pending'));
    final row = await query.getSingle();
    return row.read(pendingEvents.id.count()) ?? 0;
  }

  Future<void> markSynced(String eventId) {
    return (update(pendingEvents)..where((e) => e.id.equals(eventId)))
        .write(const PendingEventsCompanion(syncStatus: Value('synced')));
  }

  Future<void> markFailed(String eventId, String error, int retryCount) {
    final backoffSeconds = _exponentialBackoff(retryCount);
    final nextRetry = DateTime.now().add(Duration(seconds: backoffSeconds));
    return (update(pendingEvents)..where((e) => e.id.equals(eventId))).write(
      PendingEventsCompanion(
        syncStatus: const Value('pending'),
        errorMessage: Value(error),
        retryCount: Value(retryCount),
        nextRetryAt: Value(nextRetry),
      ),
    );
  }

  Future<void> markPermanentlyFailed(String eventId, String error) {
    return (update(pendingEvents)..where((e) => e.id.equals(eventId))).write(
      PendingEventsCompanion(
        syncStatus: const Value('failed'),
        errorMessage: Value(error),
      ),
    );
  }

  Future<void> cleanSynced() {
    return (delete(pendingEvents)
          ..where((e) => e.syncStatus.equals('synced')))
        .go();
  }

  int _exponentialBackoff(int retryCount) {
    // 5s, 10s, 20s, 40s, 80s cap
    const base = 5;
    final seconds = base * (1 << retryCount);
    return seconds.clamp(5, 80);
  }
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/fieldops_local.sqlite');
    return NativeDatabase.createInBackground(file);
  });
}

final localDatabaseProvider = Provider<LocalDatabase>((ref) {
  final db = LocalDatabase();
  ref.onDispose(db.close);
  return db;
});

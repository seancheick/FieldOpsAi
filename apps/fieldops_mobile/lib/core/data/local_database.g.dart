// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_database.dart';

// ignore_for_file: type=lint
class $PendingEventsTable extends PendingEvents
    with TableInfo<$PendingEventsTable, PendingEvent> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PendingEventsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _eventTypeMeta = const VerificationMeta(
    'eventType',
  );
  @override
  late final GeneratedColumn<String> eventType = GeneratedColumn<String>(
    'event_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _jobIdMeta = const VerificationMeta('jobId');
  @override
  late final GeneratedColumn<String> jobId = GeneratedColumn<String>(
    'job_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _occurredAtMeta = const VerificationMeta(
    'occurredAt',
  );
  @override
  late final GeneratedColumn<DateTime> occurredAt = GeneratedColumn<DateTime>(
    'occurred_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _retryCountMeta = const VerificationMeta(
    'retryCount',
  );
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
    'retry_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _nextRetryAtMeta = const VerificationMeta(
    'nextRetryAt',
  );
  @override
  late final GeneratedColumn<DateTime> nextRetryAt = GeneratedColumn<DateTime>(
    'next_retry_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _syncStatusMeta = const VerificationMeta(
    'syncStatus',
  );
  @override
  late final GeneratedColumn<String> syncStatus = GeneratedColumn<String>(
    'sync_status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _errorMessageMeta = const VerificationMeta(
    'errorMessage',
  );
  @override
  late final GeneratedColumn<String> errorMessage = GeneratedColumn<String>(
    'error_message',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    eventType,
    jobId,
    payload,
    occurredAt,
    createdAt,
    retryCount,
    nextRetryAt,
    syncStatus,
    errorMessage,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'pending_events';
  @override
  VerificationContext validateIntegrity(
    Insertable<PendingEvent> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('event_type')) {
      context.handle(
        _eventTypeMeta,
        eventType.isAcceptableOrUnknown(data['event_type']!, _eventTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_eventTypeMeta);
    }
    if (data.containsKey('job_id')) {
      context.handle(
        _jobIdMeta,
        jobId.isAcceptableOrUnknown(data['job_id']!, _jobIdMeta),
      );
    } else if (isInserting) {
      context.missing(_jobIdMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('occurred_at')) {
      context.handle(
        _occurredAtMeta,
        occurredAt.isAcceptableOrUnknown(data['occurred_at']!, _occurredAtMeta),
      );
    } else if (isInserting) {
      context.missing(_occurredAtMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    if (data.containsKey('retry_count')) {
      context.handle(
        _retryCountMeta,
        retryCount.isAcceptableOrUnknown(data['retry_count']!, _retryCountMeta),
      );
    }
    if (data.containsKey('next_retry_at')) {
      context.handle(
        _nextRetryAtMeta,
        nextRetryAt.isAcceptableOrUnknown(
          data['next_retry_at']!,
          _nextRetryAtMeta,
        ),
      );
    }
    if (data.containsKey('sync_status')) {
      context.handle(
        _syncStatusMeta,
        syncStatus.isAcceptableOrUnknown(data['sync_status']!, _syncStatusMeta),
      );
    }
    if (data.containsKey('error_message')) {
      context.handle(
        _errorMessageMeta,
        errorMessage.isAcceptableOrUnknown(
          data['error_message']!,
          _errorMessageMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  PendingEvent map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PendingEvent(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      eventType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}event_type'],
      )!,
      jobId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}job_id'],
      )!,
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
      occurredAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}occurred_at'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      retryCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}retry_count'],
      )!,
      nextRetryAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}next_retry_at'],
      ),
      syncStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sync_status'],
      )!,
      errorMessage: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}error_message'],
      ),
    );
  }

  @override
  $PendingEventsTable createAlias(String alias) {
    return $PendingEventsTable(attachedDatabase, alias);
  }
}

class PendingEvent extends DataClass implements Insertable<PendingEvent> {
  final String id;
  final String eventType;
  final String jobId;
  final String payload;
  final DateTime occurredAt;
  final DateTime createdAt;
  final int retryCount;
  final DateTime? nextRetryAt;
  final String syncStatus;
  final String? errorMessage;
  const PendingEvent({
    required this.id,
    required this.eventType,
    required this.jobId,
    required this.payload,
    required this.occurredAt,
    required this.createdAt,
    required this.retryCount,
    this.nextRetryAt,
    required this.syncStatus,
    this.errorMessage,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['event_type'] = Variable<String>(eventType);
    map['job_id'] = Variable<String>(jobId);
    map['payload'] = Variable<String>(payload);
    map['occurred_at'] = Variable<DateTime>(occurredAt);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['retry_count'] = Variable<int>(retryCount);
    if (!nullToAbsent || nextRetryAt != null) {
      map['next_retry_at'] = Variable<DateTime>(nextRetryAt);
    }
    map['sync_status'] = Variable<String>(syncStatus);
    if (!nullToAbsent || errorMessage != null) {
      map['error_message'] = Variable<String>(errorMessage);
    }
    return map;
  }

  PendingEventsCompanion toCompanion(bool nullToAbsent) {
    return PendingEventsCompanion(
      id: Value(id),
      eventType: Value(eventType),
      jobId: Value(jobId),
      payload: Value(payload),
      occurredAt: Value(occurredAt),
      createdAt: Value(createdAt),
      retryCount: Value(retryCount),
      nextRetryAt: nextRetryAt == null && nullToAbsent
          ? const Value.absent()
          : Value(nextRetryAt),
      syncStatus: Value(syncStatus),
      errorMessage: errorMessage == null && nullToAbsent
          ? const Value.absent()
          : Value(errorMessage),
    );
  }

  factory PendingEvent.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PendingEvent(
      id: serializer.fromJson<String>(json['id']),
      eventType: serializer.fromJson<String>(json['eventType']),
      jobId: serializer.fromJson<String>(json['jobId']),
      payload: serializer.fromJson<String>(json['payload']),
      occurredAt: serializer.fromJson<DateTime>(json['occurredAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      nextRetryAt: serializer.fromJson<DateTime?>(json['nextRetryAt']),
      syncStatus: serializer.fromJson<String>(json['syncStatus']),
      errorMessage: serializer.fromJson<String?>(json['errorMessage']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'eventType': serializer.toJson<String>(eventType),
      'jobId': serializer.toJson<String>(jobId),
      'payload': serializer.toJson<String>(payload),
      'occurredAt': serializer.toJson<DateTime>(occurredAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'retryCount': serializer.toJson<int>(retryCount),
      'nextRetryAt': serializer.toJson<DateTime?>(nextRetryAt),
      'syncStatus': serializer.toJson<String>(syncStatus),
      'errorMessage': serializer.toJson<String?>(errorMessage),
    };
  }

  PendingEvent copyWith({
    String? id,
    String? eventType,
    String? jobId,
    String? payload,
    DateTime? occurredAt,
    DateTime? createdAt,
    int? retryCount,
    Value<DateTime?> nextRetryAt = const Value.absent(),
    String? syncStatus,
    Value<String?> errorMessage = const Value.absent(),
  }) => PendingEvent(
    id: id ?? this.id,
    eventType: eventType ?? this.eventType,
    jobId: jobId ?? this.jobId,
    payload: payload ?? this.payload,
    occurredAt: occurredAt ?? this.occurredAt,
    createdAt: createdAt ?? this.createdAt,
    retryCount: retryCount ?? this.retryCount,
    nextRetryAt: nextRetryAt.present ? nextRetryAt.value : this.nextRetryAt,
    syncStatus: syncStatus ?? this.syncStatus,
    errorMessage: errorMessage.present ? errorMessage.value : this.errorMessage,
  );
  PendingEvent copyWithCompanion(PendingEventsCompanion data) {
    return PendingEvent(
      id: data.id.present ? data.id.value : this.id,
      eventType: data.eventType.present ? data.eventType.value : this.eventType,
      jobId: data.jobId.present ? data.jobId.value : this.jobId,
      payload: data.payload.present ? data.payload.value : this.payload,
      occurredAt: data.occurredAt.present
          ? data.occurredAt.value
          : this.occurredAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      retryCount: data.retryCount.present
          ? data.retryCount.value
          : this.retryCount,
      nextRetryAt: data.nextRetryAt.present
          ? data.nextRetryAt.value
          : this.nextRetryAt,
      syncStatus: data.syncStatus.present
          ? data.syncStatus.value
          : this.syncStatus,
      errorMessage: data.errorMessage.present
          ? data.errorMessage.value
          : this.errorMessage,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PendingEvent(')
          ..write('id: $id, ')
          ..write('eventType: $eventType, ')
          ..write('jobId: $jobId, ')
          ..write('payload: $payload, ')
          ..write('occurredAt: $occurredAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('retryCount: $retryCount, ')
          ..write('nextRetryAt: $nextRetryAt, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('errorMessage: $errorMessage')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    eventType,
    jobId,
    payload,
    occurredAt,
    createdAt,
    retryCount,
    nextRetryAt,
    syncStatus,
    errorMessage,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PendingEvent &&
          other.id == this.id &&
          other.eventType == this.eventType &&
          other.jobId == this.jobId &&
          other.payload == this.payload &&
          other.occurredAt == this.occurredAt &&
          other.createdAt == this.createdAt &&
          other.retryCount == this.retryCount &&
          other.nextRetryAt == this.nextRetryAt &&
          other.syncStatus == this.syncStatus &&
          other.errorMessage == this.errorMessage);
}

class PendingEventsCompanion extends UpdateCompanion<PendingEvent> {
  final Value<String> id;
  final Value<String> eventType;
  final Value<String> jobId;
  final Value<String> payload;
  final Value<DateTime> occurredAt;
  final Value<DateTime> createdAt;
  final Value<int> retryCount;
  final Value<DateTime?> nextRetryAt;
  final Value<String> syncStatus;
  final Value<String?> errorMessage;
  final Value<int> rowid;
  const PendingEventsCompanion({
    this.id = const Value.absent(),
    this.eventType = const Value.absent(),
    this.jobId = const Value.absent(),
    this.payload = const Value.absent(),
    this.occurredAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.nextRetryAt = const Value.absent(),
    this.syncStatus = const Value.absent(),
    this.errorMessage = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PendingEventsCompanion.insert({
    required String id,
    required String eventType,
    required String jobId,
    required String payload,
    required DateTime occurredAt,
    this.createdAt = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.nextRetryAt = const Value.absent(),
    this.syncStatus = const Value.absent(),
    this.errorMessage = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       eventType = Value(eventType),
       jobId = Value(jobId),
       payload = Value(payload),
       occurredAt = Value(occurredAt);
  static Insertable<PendingEvent> custom({
    Expression<String>? id,
    Expression<String>? eventType,
    Expression<String>? jobId,
    Expression<String>? payload,
    Expression<DateTime>? occurredAt,
    Expression<DateTime>? createdAt,
    Expression<int>? retryCount,
    Expression<DateTime>? nextRetryAt,
    Expression<String>? syncStatus,
    Expression<String>? errorMessage,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (eventType != null) 'event_type': eventType,
      if (jobId != null) 'job_id': jobId,
      if (payload != null) 'payload': payload,
      if (occurredAt != null) 'occurred_at': occurredAt,
      if (createdAt != null) 'created_at': createdAt,
      if (retryCount != null) 'retry_count': retryCount,
      if (nextRetryAt != null) 'next_retry_at': nextRetryAt,
      if (syncStatus != null) 'sync_status': syncStatus,
      if (errorMessage != null) 'error_message': errorMessage,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PendingEventsCompanion copyWith({
    Value<String>? id,
    Value<String>? eventType,
    Value<String>? jobId,
    Value<String>? payload,
    Value<DateTime>? occurredAt,
    Value<DateTime>? createdAt,
    Value<int>? retryCount,
    Value<DateTime?>? nextRetryAt,
    Value<String>? syncStatus,
    Value<String?>? errorMessage,
    Value<int>? rowid,
  }) {
    return PendingEventsCompanion(
      id: id ?? this.id,
      eventType: eventType ?? this.eventType,
      jobId: jobId ?? this.jobId,
      payload: payload ?? this.payload,
      occurredAt: occurredAt ?? this.occurredAt,
      createdAt: createdAt ?? this.createdAt,
      retryCount: retryCount ?? this.retryCount,
      nextRetryAt: nextRetryAt ?? this.nextRetryAt,
      syncStatus: syncStatus ?? this.syncStatus,
      errorMessage: errorMessage ?? this.errorMessage,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (eventType.present) {
      map['event_type'] = Variable<String>(eventType.value);
    }
    if (jobId.present) {
      map['job_id'] = Variable<String>(jobId.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (occurredAt.present) {
      map['occurred_at'] = Variable<DateTime>(occurredAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (nextRetryAt.present) {
      map['next_retry_at'] = Variable<DateTime>(nextRetryAt.value);
    }
    if (syncStatus.present) {
      map['sync_status'] = Variable<String>(syncStatus.value);
    }
    if (errorMessage.present) {
      map['error_message'] = Variable<String>(errorMessage.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PendingEventsCompanion(')
          ..write('id: $id, ')
          ..write('eventType: $eventType, ')
          ..write('jobId: $jobId, ')
          ..write('payload: $payload, ')
          ..write('occurredAt: $occurredAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('retryCount: $retryCount, ')
          ..write('nextRetryAt: $nextRetryAt, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('errorMessage: $errorMessage, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$LocalDatabase extends GeneratedDatabase {
  _$LocalDatabase(QueryExecutor e) : super(e);
  $LocalDatabaseManager get managers => $LocalDatabaseManager(this);
  late final $PendingEventsTable pendingEvents = $PendingEventsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [pendingEvents];
}

typedef $$PendingEventsTableCreateCompanionBuilder =
    PendingEventsCompanion Function({
      required String id,
      required String eventType,
      required String jobId,
      required String payload,
      required DateTime occurredAt,
      Value<DateTime> createdAt,
      Value<int> retryCount,
      Value<DateTime?> nextRetryAt,
      Value<String> syncStatus,
      Value<String?> errorMessage,
      Value<int> rowid,
    });
typedef $$PendingEventsTableUpdateCompanionBuilder =
    PendingEventsCompanion Function({
      Value<String> id,
      Value<String> eventType,
      Value<String> jobId,
      Value<String> payload,
      Value<DateTime> occurredAt,
      Value<DateTime> createdAt,
      Value<int> retryCount,
      Value<DateTime?> nextRetryAt,
      Value<String> syncStatus,
      Value<String?> errorMessage,
      Value<int> rowid,
    });

class $$PendingEventsTableFilterComposer
    extends Composer<_$LocalDatabase, $PendingEventsTable> {
  $$PendingEventsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get eventType => $composableBuilder(
    column: $table.eventType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get jobId => $composableBuilder(
    column: $table.jobId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get occurredAt => $composableBuilder(
    column: $table.occurredAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get nextRetryAt => $composableBuilder(
    column: $table.nextRetryAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get errorMessage => $composableBuilder(
    column: $table.errorMessage,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PendingEventsTableOrderingComposer
    extends Composer<_$LocalDatabase, $PendingEventsTable> {
  $$PendingEventsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get eventType => $composableBuilder(
    column: $table.eventType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get jobId => $composableBuilder(
    column: $table.jobId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get occurredAt => $composableBuilder(
    column: $table.occurredAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get nextRetryAt => $composableBuilder(
    column: $table.nextRetryAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get errorMessage => $composableBuilder(
    column: $table.errorMessage,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PendingEventsTableAnnotationComposer
    extends Composer<_$LocalDatabase, $PendingEventsTable> {
  $$PendingEventsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get eventType =>
      $composableBuilder(column: $table.eventType, builder: (column) => column);

  GeneratedColumn<String> get jobId =>
      $composableBuilder(column: $table.jobId, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<DateTime> get occurredAt => $composableBuilder(
    column: $table.occurredAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get nextRetryAt => $composableBuilder(
    column: $table.nextRetryAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => column,
  );

  GeneratedColumn<String> get errorMessage => $composableBuilder(
    column: $table.errorMessage,
    builder: (column) => column,
  );
}

class $$PendingEventsTableTableManager
    extends
        RootTableManager<
          _$LocalDatabase,
          $PendingEventsTable,
          PendingEvent,
          $$PendingEventsTableFilterComposer,
          $$PendingEventsTableOrderingComposer,
          $$PendingEventsTableAnnotationComposer,
          $$PendingEventsTableCreateCompanionBuilder,
          $$PendingEventsTableUpdateCompanionBuilder,
          (
            PendingEvent,
            BaseReferences<_$LocalDatabase, $PendingEventsTable, PendingEvent>,
          ),
          PendingEvent,
          PrefetchHooks Function()
        > {
  $$PendingEventsTableTableManager(
    _$LocalDatabase db,
    $PendingEventsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PendingEventsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PendingEventsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PendingEventsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> eventType = const Value.absent(),
                Value<String> jobId = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<DateTime> occurredAt = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<DateTime?> nextRetryAt = const Value.absent(),
                Value<String> syncStatus = const Value.absent(),
                Value<String?> errorMessage = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PendingEventsCompanion(
                id: id,
                eventType: eventType,
                jobId: jobId,
                payload: payload,
                occurredAt: occurredAt,
                createdAt: createdAt,
                retryCount: retryCount,
                nextRetryAt: nextRetryAt,
                syncStatus: syncStatus,
                errorMessage: errorMessage,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String eventType,
                required String jobId,
                required String payload,
                required DateTime occurredAt,
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<DateTime?> nextRetryAt = const Value.absent(),
                Value<String> syncStatus = const Value.absent(),
                Value<String?> errorMessage = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PendingEventsCompanion.insert(
                id: id,
                eventType: eventType,
                jobId: jobId,
                payload: payload,
                occurredAt: occurredAt,
                createdAt: createdAt,
                retryCount: retryCount,
                nextRetryAt: nextRetryAt,
                syncStatus: syncStatus,
                errorMessage: errorMessage,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PendingEventsTableProcessedTableManager =
    ProcessedTableManager<
      _$LocalDatabase,
      $PendingEventsTable,
      PendingEvent,
      $$PendingEventsTableFilterComposer,
      $$PendingEventsTableOrderingComposer,
      $$PendingEventsTableAnnotationComposer,
      $$PendingEventsTableCreateCompanionBuilder,
      $$PendingEventsTableUpdateCompanionBuilder,
      (
        PendingEvent,
        BaseReferences<_$LocalDatabase, $PendingEventsTable, PendingEvent>,
      ),
      PendingEvent,
      PrefetchHooks Function()
    >;

class $LocalDatabaseManager {
  final _$LocalDatabase _db;
  $LocalDatabaseManager(this._db);
  $$PendingEventsTableTableManager get pendingEvents =>
      $$PendingEventsTableTableManager(_db, _db.pendingEvents);
}

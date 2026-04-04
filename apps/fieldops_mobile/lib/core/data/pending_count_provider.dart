import 'dart:async';

import 'package:fieldops_mobile/core/data/local_database.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final pendingEventCountProvider = StreamProvider<int>((ref) {
  final database = ref.watch(localDatabaseProvider);
  return Stream.periodic(const Duration(seconds: 5), (_) => database)
      .asyncMap((db) => db.pendingCount());
});

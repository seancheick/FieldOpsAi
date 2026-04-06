import 'package:fieldops_mobile/core/config/fieldops_environment.dart';
import 'package:fieldops_mobile/features/schedule/data/supabase_schedule_repository.dart';
import 'package:fieldops_mobile/features/schedule/domain/schedule_repository.dart';
import 'package:fieldops_mobile/features/schedule/domain/worker_schedule_shift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final scheduleRepositoryProvider = Provider<ScheduleRepository>((ref) {
  final environment = ref.watch(fieldOpsEnvironmentProvider);
  if (!environment.isConfigured) {
    return const _UnconfiguredScheduleRepository();
  }

  return SupabaseScheduleRepository(Supabase.instance.client);
});

class _UnconfiguredScheduleRepository implements ScheduleRepository {
  const _UnconfiguredScheduleRepository();

  @override
  Future<List<WorkerScheduleShift>> fetchMySchedule({
    DateTime? from,
    DateTime? to,
  }) {
    throw const ScheduleRepositoryException.unknown(
      'Mobile app is missing Supabase configuration.',
    );
  }

  @override
  Future<String> requestShiftSwap({
    required String shiftId,
    String? notes,
  }) {
    throw const ScheduleRepositoryException.unknown(
      'Mobile app is missing Supabase configuration.',
    );
  }
}

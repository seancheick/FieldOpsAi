import 'package:fieldops_mobile/features/schedule/data/schedule_repository_provider.dart';
import 'package:fieldops_mobile/features/schedule/domain/worker_schedule_shift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final workerScheduleControllerProvider =
    AsyncNotifierProvider<WorkerScheduleController, List<WorkerScheduleShift>>(
      WorkerScheduleController.new,
    );

class WorkerScheduleController extends AsyncNotifier<List<WorkerScheduleShift>> {
  @override
  Future<List<WorkerScheduleShift>> build() {
    return ref.watch(scheduleRepositoryProvider).fetchMySchedule();
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(scheduleRepositoryProvider).fetchMySchedule(),
    );
  }
}

import 'package:fieldops_mobile/app/theme/app_theme.dart';
import 'package:fieldops_mobile/features/schedule/data/schedule_repository_provider.dart';
import 'package:fieldops_mobile/features/schedule/domain/schedule_repository.dart';
import 'package:fieldops_mobile/features/schedule/domain/worker_schedule_shift.dart';
import 'package:fieldops_mobile/features/schedule/presentation/worker_schedule_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fieldops_mobile/l10n/app_localizations.dart';

void main() {
  testWidgets('worker schedule screen shows published shifts and update badge', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          scheduleRepositoryProvider.overrideWithValue(
            FakeScheduleRepository(
              shifts: [
                WorkerScheduleShift(
                  id: 'shift-1',
                  jobId: 'job-1',
                  jobName: 'Grid Restoration',
                  shiftDate: DateTime.utc(2026, 4, 6),
                  startTime: '07:00',
                  endTime: '15:30',
                  status: WorkerScheduleStatus.published,
                  publishedAt: DateTime.utc(2026, 4, 5, 12, 0),
                  notes: 'Crew briefing at 6:45.',
                ),
              ],
            ),
          ),
        ],
        child: MaterialApp(
          theme: buildFieldOpsTheme(),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: const WorkerScheduleScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('My schedule'), findsOneWidget);
    expect(find.text('Grid Restoration'), findsOneWidget);
    expect(find.text('07:00 - 15:30'), findsOneWidget);
    expect(find.text('Updated'), findsOneWidget);
    expect(find.text('Crew briefing at 6:45.'), findsOneWidget);
  });
}

class FakeScheduleRepository implements ScheduleRepository {
  FakeScheduleRepository({required this.shifts});

  final List<WorkerScheduleShift> shifts;

  @override
  Future<List<WorkerScheduleShift>> fetchMySchedule({
    DateTime? from,
    DateTime? to,
  }) async {
    return shifts;
  }
}

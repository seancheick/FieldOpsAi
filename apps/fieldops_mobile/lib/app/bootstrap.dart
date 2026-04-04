import 'dart:async';

import 'package:fieldops_mobile/app/app.dart';
import 'package:fieldops_mobile/core/config/fieldops_environment.dart';
import 'package:fieldops_mobile/core/data/sync_engine.dart';
import 'package:fieldops_mobile/core/observability/fieldops_provider_observer.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  final environment = FieldOpsEnvironment.fromDartDefine();

  if (environment.isConfigured) {
    await Supabase.initialize(
      url: environment.supabaseUrl,
      anonKey: environment.supabaseAnonKey,
    );
  }

  final container = ProviderContainer(
    overrides: [fieldOpsEnvironmentProvider.overrideWithValue(environment)],
    observers: [FieldOpsProviderObserver()],
  );

  const sentryDsn = String.fromEnvironment('SENTRY_DSN', defaultValue: '');

  final app = UncontrolledProviderScope(
    container: container,
    child: const FieldOpsApp(),
  );

  if (sentryDsn.isNotEmpty) {
    try {
      await SentryFlutter.init(
        (options) {
          options.dsn = sentryDsn;
          options.tracesSampleRate = kReleaseMode ? 0.2 : 1.0;
          options.environment = kReleaseMode ? 'production' : 'development';
          options.attachScreenshot = kReleaseMode;
          options.attachViewHierarchy = kReleaseMode;
          options.beforeSend = (event, hint) {
            final breadcrumbs = event.breadcrumbs?.map((b) {
              final data = b.data;
              if (data != null && data.containsKey('url')) {
                final raw = data['url']?.toString() ?? '';
                final uri = Uri.tryParse(raw);
                if (uri != null && uri.hasQuery) {
                  final sanitized = uri.replace(query: '').toString();
                  final sanitizedData = Map<String, dynamic>.from(data)
                    ..['url'] = sanitized;
                  return b.copyWith(data: sanitizedData);
                }
              }
              return b;
            }).toList();
            return event.copyWith(breadcrumbs: breadcrumbs);
          };
        },
        appRunner: () async {
          if (environment.isConfigured) {
            container.read(syncEngineProvider).start();
          }
          runApp(app);
        },
      );
    } on Object catch (e, stack) {
      debugPrint('Sentry init failed, running without error tracking: $e\n$stack');
      if (environment.isConfigured) {
        container.read(syncEngineProvider).start();
      }
      runApp(app);
    }
  } else {
    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      debugPrint('Flutter error: ${details.exceptionAsString()}');
    };

    PlatformDispatcher.instance.onError = (error, stack) {
      debugPrint('Platform error: $error\n$stack');
      return true;
    };

    if (environment.isConfigured) {
      container.read(syncEngineProvider).start();
    }
    runApp(app);
  }
}

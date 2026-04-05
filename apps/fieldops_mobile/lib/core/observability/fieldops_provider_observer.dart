import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Forwards Riverpod provider errors to the error reporting system.
base class FieldOpsProviderObserver extends ProviderObserver {
  @override
  void providerDidFail(
    ProviderObserverContext context,
    Object error,
    StackTrace stackTrace,
  ) {
    // `print` is used here so provider errors are visible in all build modes
    // (debug, profile, release). `debugPrint` is suppressed in release builds.
    //
    // TODO(sprint-7): Replace with Sentry.captureException(error, stackTrace)
    // once Sentry is wired up — see infra/observability/sentry_setup.md.
    // ignore: avoid_print
    print(
      '[FieldOps] Provider ${context.provider.name ?? context.provider.runtimeType} '
      'failed: $error\n$stackTrace',
    );
  }
}

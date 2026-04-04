import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Forwards Riverpod provider errors to the error reporting system.
base class FieldOpsProviderObserver extends ProviderObserver {
  @override
  void providerDidFail(
    ProviderObserverContext context,
    Object error,
    StackTrace stackTrace,
  ) {
    // TODO: Forward to Sentry/Crashlytics when integrated
    debugPrint(
      '[FieldOps] Provider ${context.provider.name ?? context.provider.runtimeType} failed: $error',
    );
  }
}

import 'package:fieldops_mobile/app/main_shell.dart';
import 'package:fieldops_mobile/app/theme/app_theme.dart';
import 'package:fieldops_mobile/core/config/fieldops_environment.dart';
import 'package:fieldops_mobile/features/auth/presentation/app_lock_controller.dart';
import 'package:fieldops_mobile/features/auth/presentation/app_lock_screen.dart';
import 'package:fieldops_mobile/features/auth/presentation/configuration_required_screen.dart';
import 'package:fieldops_mobile/features/auth/presentation/login_screen.dart';
import 'package:fieldops_mobile/features/auth/presentation/session_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:fieldops_mobile/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FieldOpsApp extends ConsumerStatefulWidget {
  const FieldOpsApp({super.key});

  @override
  ConsumerState<FieldOpsApp> createState() => _FieldOpsAppState();
}

class _FieldOpsAppState extends ConsumerState<FieldOpsApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final lockController = ref.read(appLockControllerProvider.notifier);
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      // Lock when app goes to background.
      lockController.lock();
    } else if (state == AppLifecycleState.resumed) {
      // Reset inactivity timer on resume if not locked.
      lockController.recordActivity();
    }
  }

  @override
  Widget build(BuildContext context) {
    final environment = ref.watch(fieldOpsEnvironmentProvider);
    final session = ref.watch(sessionControllerProvider);
    final lockState = ref.watch(appLockControllerProvider);

    // Enable lock when authenticated, disable when not.
    ref.listen(sessionControllerProvider, (prev, next) {
      final lockNotifier = ref.read(appLockControllerProvider.notifier);
      if (next.isAuthenticated && !(prev?.isAuthenticated ?? false)) {
        lockNotifier.enable();
      } else if (!next.isAuthenticated) {
        lockNotifier.disable();
      }
    });

    final Widget home;
    if (!environment.isConfigured) {
      home = const ConfigurationRequiredScreen();
    } else if (!session.isAuthenticated) {
      home = const LoginScreen();
    } else if (lockState.isLocked) {
      home = const AppLockScreen();
    } else {
      home = MainShell(email: session.email);
    }

    return MaterialApp(
      title: 'FieldOps AI',
      debugShowCheckedModeBanner: false,
      theme: buildFieldOpsTheme(),
      darkTheme: buildFieldOpsDarkTheme(),
      themeMode: ThemeMode.system,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: home,
    );
  }
}

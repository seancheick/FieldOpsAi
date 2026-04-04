import 'package:fieldops_mobile/app/theme/app_theme.dart';
import 'package:fieldops_mobile/core/config/fieldops_environment.dart';
import 'package:fieldops_mobile/features/auth/presentation/configuration_required_screen.dart';
import 'package:fieldops_mobile/features/auth/presentation/login_screen.dart';
import 'package:fieldops_mobile/features/auth/presentation/session_controller.dart';
import 'package:fieldops_mobile/features/home/presentation/home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:fieldops_mobile/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FieldOpsApp extends ConsumerWidget {
  const FieldOpsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final environment = ref.watch(fieldOpsEnvironmentProvider);
    final session = ref.watch(sessionControllerProvider);

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
      home: !environment.isConfigured
          ? const ConfigurationRequiredScreen()
          : session.isAuthenticated
              ? HomeScreen(email: session.email)
              : const LoginScreen(),
    );
  }
}

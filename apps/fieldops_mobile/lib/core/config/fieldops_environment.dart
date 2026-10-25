import 'package:flutter_riverpod/flutter_riverpod.dart';

final fieldOpsEnvironmentProvider = Provider<FieldOpsEnvironment>(
  (_) => FieldOpsEnvironment.fromDartDefine(),
);

class FieldOpsEnvironment {
  const FieldOpsEnvironment({
    required this.supabaseUrl,
    required this.supabaseAnonKey,
  });

  factory FieldOpsEnvironment.fromDartDefine() {
    return const FieldOpsEnvironment(
      supabaseUrl: String.fromEnvironment(
        'SUPABASE_URL',
        defaultValue: 'https://cpqrazrszhcxjvursuci.supabase.co',
      ),
      supabaseAnonKey: String.fromEnvironment(
        'SUPABASE_ANON_KEY',
        defaultValue:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwcXJhenJzemhjeGp2dXJzdWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzc5ODEsImV4cCI6MjA5MDgxMzk4MX0.W9InOewMmI_SI25webZyoH8MBmx2jhhlkLo5q7bmtdE',
      ),
    );
  }

  final String supabaseUrl;
  final String supabaseAnonKey;

  bool get isConfigured => supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}

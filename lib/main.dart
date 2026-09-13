import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/presentation/app/inout_app.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  const supabasePublishableKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
  );
  const apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  const useLegacyRpc = bool.fromEnvironment('USE_LEGACY_HOUSEHOLD_RPC');
  final backendConfigured =
      supabaseUrl.isNotEmpty &&
      supabasePublishableKey.isNotEmpty &&
      (useLegacyRpc || apiBaseUrl.isNotEmpty);

  if (backendConfigured) {
    await Supabase.initialize(
      url: supabaseUrl,
      publishableKey: supabasePublishableKey,
    );
  }

  runApp(
    ProviderScope(
      overrides: [
        if (apiBaseUrl.isNotEmpty)
          apiBaseUrlProvider.overrideWithValue(Uri.parse(apiBaseUrl)),
      ],
      child: InOutApp(backendConfigured: backendConfigured),
    ),
  );
}

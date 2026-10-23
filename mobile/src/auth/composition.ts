import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createClient,
  processLock,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { createAuthService, requirePublicConfig } from "@inout/identity";
import { createSupabaseAuthRepository } from "@inout/identity/supabase";
let client: SupabaseClient | undefined;
let email = "";
export function getAuthClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  requirePublicConfig(url, key);
  return (client ??= createClient(url!, key!, {
    auth: {
      storage: AsyncStorage,
      flowType: "pkce",
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
      ...(Platform.OS !== "web" ? { lock: processLock } : {}),
    },
  }));
}
export function getAuth() {
  return createAuthService(
    createSupabaseAuthRepository(
      getAuthClient(),
      Linking.createURL("auth/callback"),
    ),
  );
}
export function rememberEmail(value: string) {
  email = value.trim().toLowerCase();
}
export function pendingEmail() {
  return email;
}

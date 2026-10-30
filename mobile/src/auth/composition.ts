import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  createClient,
  processLock,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { createAuthService, requirePublicConfig } from "@inout/identity";
import { createSupabaseAuthRepository } from "@inout/identity/supabase";

export const secureAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      return AsyncStorage.setItem(key, value);
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      return AsyncStorage.removeItem(key);
    }
    return SecureStore.deleteItemAsync(key);
  },
};

let client: SupabaseClient | undefined;
let email = "";
export function getAuthClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  requirePublicConfig(url, key);
  return (client ??= createClient(url!, key!, {
    auth: {
      storage: secureAuthStorage,
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
      Linking.createURL("auth/recuperar"),
    ),
  );
}
export function rememberEmail(value: string) {
  email = value.trim().toLowerCase();
}
export function pendingEmail() {
  return email;
}

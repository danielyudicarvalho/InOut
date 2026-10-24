import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { getAuthClient } from "../auth/composition";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Lora_700Bold } from "@expo-google-fonts/lora/700Bold";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
export default function Layout() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    try {
      const client = getAuthClient();
      if (AppState.currentState === "active") client.auth.startAutoRefresh();
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") client.auth.startAutoRefresh();
        else client.auth.stopAutoRefresh();
      });
      return () => {
        listener.remove();
        client.auth.stopAutoRefresh();
      };
    } catch {
      return;
    }
  }, []);
  const [loaded, error] = useFonts({ Lora_700Bold, DMSans_400Regular });
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}

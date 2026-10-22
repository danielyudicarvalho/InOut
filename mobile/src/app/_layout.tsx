import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Lora_700Bold } from "@expo-google-fonts/lora/700Bold";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
export default function Layout() {
  const [loaded, error] = useFonts({ Lora_700Bold, DMSans_400Regular });
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}

import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Lora_700Bold } from "@expo-google-fonts/lora/700Bold";
import { useFonts } from "expo-font";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
export default function App() {
  const [loaded, error] = useFonts({ Lora_700Bold, DMSans_400Regular });
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <WelcomeScreen fontsReady={loaded && !error} />
    </SafeAreaProvider>
  );
}

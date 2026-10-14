import { Stack } from "expo-router";
import "../global.css";
import { AppProvider } from "@/state/app";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#F7F8F4" },
          }}
        />
      </AppProvider>
    </SafeAreaProvider>
  );
}

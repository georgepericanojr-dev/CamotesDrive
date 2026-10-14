import { Stack } from "expo-router";
import "../global.css";
import { DemoProvider } from "@/state/demo";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DemoProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#F7F8F4" },
          }}
        />
      </DemoProvider>
    </SafeAreaProvider>
  );
}

import { Stack } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import "../global.css";
import { AppProvider, useApp } from "@/state/app";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppNotice } from "@/components/camotes/app-notice";
import { MotionProvider, useReducedMotion } from "@/components/camotes/motion";
import { stackMotion } from "@/lib/motion";

function AppNavigator() {
  const { signedIn, initializing } = useApp();
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const mobileNavigation = Platform.OS !== "web" || width < 1000;

  // Wait for local session restoration, not API/profile requests. This keeps
  // Explore from flashing before login and preserves valid stored sessions.
  if (initializing) {
    return (
      <View className="flex-1 bg-sand items-center justify-center gap-4">
        <ActivityIndicator color="#164E43" />
        <Text accessibilityLiveRegion="polite" className="text-sm text-ocean">
          Loading CamotesDrive…
        </Text>
      </View>
    );
  }

  return (
    <Stack
      initialRouteName={signedIn ? "index" : "auth"}
      screenOptions={({ route }) => ({
        ...stackMotion(route.name, reducedMotion, mobileNavigation),
        headerShown: false,
        contentStyle: { backgroundColor: "#F7F8F4" },
      })}
    >
      {/* First available route is the fallback when a session ends. */}
      <Stack.Screen name="auth" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="legal" />
      <Stack.Screen name="support" />
      {/* Admin has its own role gate and preserves its sign-in destination. */}
      <Stack.Screen name="admin" />
      <Stack.Protected guard={signedIn || Platform.OS === "web"}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="explore" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="trips" />
        <Stack.Screen name="trip/[id]" />
        <Stack.Screen name="booking" />
        <Stack.Screen name="vehicle/[id]" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="verification" />
        <Stack.Screen name="provider" />
        <Stack.Screen name="vehicles" />
        <Stack.Screen name="listing" />
        <Stack.Screen name="availability" />
        <Stack.Screen name="earnings" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <MotionProvider>
        <AppProvider>
          <View style={{ flex: 1 }}>
            <AppNavigator />
            <AppNotice />
          </View>
        </AppProvider>
      </MotionProvider>
    </SafeAreaProvider>
  );
}

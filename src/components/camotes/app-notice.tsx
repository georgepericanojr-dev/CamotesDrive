import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/state/app";

// Keep feedback above the navigator so it survives login/logout redirects and
// is also visible on the standalone login page and admin dashboard.
export function AppNotice() {
  const { notice, toast } = useApp();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => toast(""), 6000);
    return () => clearTimeout(timer);
  }, [notice, toast]);
  if (!notice) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 12,
        left: 16,
        right: 16,
        alignItems: "center",
        zIndex: 100,
      }}
    >
      <View
        className="w-full max-w-lg bg-ocean rounded-2xl px-5 py-3 flex-row items-center gap-3"
        style={{ elevation: 8, boxShadow: "0 6px 24px rgba(27, 48, 42, 0.18)" }}
      >
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="text-sm leading-5 text-white flex-1"
        >
          {notice}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          onPress={() => toast("")}
          hitSlop={8}
          className="w-8 h-8 items-center justify-center"
        >
          <Text className="text-white text-xl">×</Text>
        </Pressable>
      </View>
    </View>
  );
}

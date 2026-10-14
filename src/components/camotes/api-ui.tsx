import { useRef, useState } from "react";
import { Text, View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Button, Card } from "./ui";
import { useApp } from "@/state/app";
export function AsyncButton({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => Promise<unknown>;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const { toast } = useApp();
  return (
    <Button
      title={busy ? "Working…" : title}
      secondary={secondary}
      disabled={disabled || busy}
      onPress={() => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        void onPress()
          .catch((e) =>
            toast(e instanceof Error ? e.message : "Unable to complete action"),
          )
          .finally(() => {
            lock.current = false;
            setBusy(false);
          });
      }}
    />
  );
}
export function ResourceState({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: string;
  retry?: () => void;
}) {
  return loading ? (
    <View className="py-6">
      <ActivityIndicator color="#164E43" />
      <Text className="text-xs text-muted text-center mt-3">
        Loading your island days…
      </Text>
    </View>
  ) : error ? (
    <Card>
      <Text accessibilityRole="alert" className="text-sm text-ink mb-4">
        {error}
      </Text>
      {retry && <Button secondary title="Try again" onPress={retry} />}
    </Card>
  ) : null;
}
export function SignInRequired() {
  const { signedIn } = useApp();
  return signedIn ? null : (
    <Card>
      <Text className="text-sm text-muted mb-4">
        Sign in to manage your trips and account.
      </Text>
      <Button title="Sign in" onPress={() => router.push("/auth")} />
    </Card>
  );
}

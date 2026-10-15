import { useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/camotes/ui";
import { useApp } from "@/state/app";
import { authErrorMessage } from "@/lib/auth-feedback";

export function SignOutButton({
  variant = "default",
}: {
  variant?: "default" | "admin";
}) {
  const { signOut } = useApp();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const cancelButton = useRef<View>(null);

  const dismiss = () => {
    if (pending.current) return;
    setVisible(false);
    setError("");
  };
  const confirm = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await signOut();
      setVisible(false);
      router.replace("/auth");
    } catch (cause) {
      setError(authErrorMessage(cause, "logout"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      {variant === "admin" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => {
            setError("");
            setVisible(true);
          }}
          className="min-h-[48px] items-center justify-center rounded-2xl border border-[#DDE5DD] bg-white px-6 py-3 hover:bg-mint focus:bg-mint"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text className="text-sm font-semibold text-ink">Sign out</Text>
        </Pressable>
      ) : (
        <Button
          secondary
          title="Sign out"
          onPress={() => {
            setError("");
            setVisible(true);
          }}
        />
      )}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={dismiss}
        onShow={() => cancelButton.current?.focus()}
      >
        <View
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: "rgba(27, 48, 42, 0.5)" }}
        >
          <View
            accessibilityViewIsModal
            accessibilityLabel="Sign out confirmation"
            className="w-full max-w-sm rounded-3xl border border-[#E6EAE2] bg-sand p-6"
          >
            <Text
              accessibilityRole="header"
              className="text-2xl font-semibold text-ink"
            >
              Sign out?
            </Text>
            <Text className="mt-3 text-sm leading-6 text-muted">
              Are you sure you want to sign out? You will return to the login
              screen.
            </Text>
            {!!error && (
              <View className="mt-4 rounded-xl bg-[#FFF1E2] p-3">
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                  className="text-sm leading-5 text-ink"
                >
                  {error}
                </Text>
              </View>
            )}
            <View className="mt-6 flex-row gap-3">
              <Pressable
                ref={cancelButton}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={dismiss}
                className="flex-1 items-center justify-center rounded-2xl border border-[#D9E5DC] bg-mint px-3 py-4"
                style={({ pressed }) => ({
                  opacity: busy ? 0.5 : pressed ? 0.75 : 1,
                })}
              >
                <Text className="text-sm font-semibold text-ocean">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={busy ? "Signing out" : "Yes, sign out"}
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() => void confirm()}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-ocean px-3 py-4"
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                {busy && <ActivityIndicator color="#FFFFFF" size="small" />}
                <Text className="text-sm font-semibold text-white">
                  {busy ? "Signing out…" : "Yes, sign out"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

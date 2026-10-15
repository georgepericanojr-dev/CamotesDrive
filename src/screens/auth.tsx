import { useRef, useState, type Ref } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import { AppIcon } from "@/components/camotes/app-icon";
import { useApp } from "@/state/app";
import { renterHomeHref } from "@/lib/navigation";
import {
  authErrorMessage,
  validateAuthForm,
  type AuthField,
  type AuthMode,
} from "@/lib/auth-feedback";

function FormIcon({ name }: { name: "email" | "password" | "name" }) {
  return (
    <AppIcon
      name={name === "email" ? "mail" : name === "password" ? "lock" : "user"}
      size={22}
    />
  );
}

function LoginField({
  label,
  icon,
  trailing,
  error,
  inputRef,
  ...props
}: TextInputProps & {
  label: string;
  icon: "email" | "password" | "name";
  trailing?: React.ReactNode;
  error?: string;
  inputRef?: Ref<TextInput>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View className="mb-5">
      <Text className="text-xs font-semibold text-ocean mb-2">{label}</Text>
      <View
        className={`min-h-[56px] flex-row items-center gap-3 rounded-2xl bg-mint border px-4 ${error ? "border-coral" : focused ? "border-ocean" : "border-[#D9E5DC]"}`}
      >
        <FormIcon name={icon} />
        <TextInput
          {...props}
          ref={inputRef}
          accessibilityLabel={label}
          aria-invalid={!!error}
          placeholderTextColor="#77817A"
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          className="flex-1 py-4 text-sm text-ink"
          style={{
            minWidth: 0,
            ...(Platform.OS === "web" ? { outlineWidth: 0 } : {}),
          }}
        />
        {trailing}
      </View>
      {!!error && (
        <Text
          accessibilityRole="alert"
          className="text-xs leading-5 mt-2 text-ink"
        >
          {error}
        </Text>
      )}
    </View>
  );
}

export default function Auth() {
  const { mutate, toast } = useApp();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const destination = next === "/admin" ? "/admin" : renterHomeHref;
  const [kind, setKind] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    success: boolean;
  } | null>(null);
  const submitting = useRef(false);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const nameInput = useRef<TextInput>(null);
  const [errors, setErrors] = useState<Partial<Record<AuthField, string>>>({});
  const redirect =
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ||
    Linking.createURL("auth/callback");
  const disabled = busy;
  const clearFieldError = (field: AuthField) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback(null);
  };
  const validateField = (field: AuthField) => {
    const nextErrors = validateAuthForm(kind, {
      email,
      password,
      name,
      consent,
    });
    setErrors((current) => ({ ...current, [field]: nextErrors[field] }));
  };

  const changeKind = (mode: AuthMode) => {
    setKind(mode);
    setFeedback(null);
    setShowPassword(false);
    setErrors({});
  };
  const submit = async () => {
    if (disabled || submitting.current) return;
    const validation = validateAuthForm(kind, {
      email,
      password,
      name,
      consent,
    });
    setErrors(validation);
    if (Object.keys(validation).length) {
      setFeedback({
        success: false,
        message: "Please check the highlighted fields.",
      });
      if (validation.name) nameInput.current?.focus();
      else if (validation.email) emailInput.current?.focus();
      else if (validation.password) passwordInput.current?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setFeedback(null);
    toast("");
    try {
      if (kind === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: redirect },
        );
        if (error) throw error;
        setFeedback({
          success: true,
          message: "Check your email for a password reset link.",
        });
      } else if (kind === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirect,
            data: { full_name: name.trim() },
          },
        });
        if (error) throw error;
        if (data.session) {
          try {
            await mutate("/me", { full_name: name.trim(), accept_terms: true });
          } catch {
            toast(
              "Account created successfully. Complete your profile and accept the rental terms to continue.",
            );
            router.replace("/profile");
            return;
          }
          toast("Account created successfully. Welcome to CamotesDrive!");
          router.replace(destination);
        } else {
          setFeedback({
            success: true,
            message:
              "Check your email to verify your account, then sign in and complete your profile.",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast("Successful login. Welcome back!");
        router.replace(destination);
      }
    } catch (error) {
      setFeedback({
        success: false,
        message: authErrorMessage(error, kind),
      });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
            paddingVertical: 48,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 380,
            }}
          >
            <View className="items-center mb-10">
              <Image
                source={require("../../assets/branding/splash-icon.png")}
                accessibilityLabel="CamotesDrive"
                style={{ width: 250, height: 250 }}
                resizeMode="contain"
              />
              <Text className="text-xs text-muted mt-2">
                A little island freedom.
              </Text>
            </View>

            {kind !== "login" && (
              <View className="mb-6">
                <Text
                  accessibilityRole="header"
                  className="text-xl font-semibold text-ink"
                >
                  {kind === "register"
                    ? "Create your account"
                    : "Forgot your password?"}
                </Text>
                <Text className="text-sm text-muted mt-2 leading-5">
                  {kind === "register"
                    ? "Your next island day starts here."
                    : "Enter your email and we’ll send you a reset link."}
                </Text>
              </View>
            )}
            {kind === "register" && (
              <LoginField
                label="Full name"
                icon="name"
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  clearFieldError("name");
                }}
                inputRef={nameInput}
                error={errors.name}
                onBlur={() => validateField("name")}
                maxLength={120}
                autoComplete="name"
                textContentType="name"
                editable={!busy}
              />
            )}
            <LoginField
              label="Email Address"
              icon="email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                clearFieldError("email");
              }}
              inputRef={emailInput}
              error={errors.email}
              onBlur={() => validateField("email")}
              maxLength={254}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!busy}
              returnKeyType={kind === "reset" ? "go" : "next"}
              onSubmitEditing={
                kind === "reset"
                  ? () => void submit()
                  : () => passwordInput.current?.focus()
              }
            />
            {kind !== "reset" && (
              <LoginField
                label="Password"
                icon="password"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  clearFieldError("password");
                }}
                inputRef={passwordInput}
                error={errors.password}
                onBlur={() => validateField("password")}
                placeholder={
                  kind === "register"
                    ? "At least 8 characters"
                    : "Enter your password"
                }
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={
                  kind === "register" ? "new-password" : "current-password"
                }
                textContentType={
                  kind === "register" ? "newPassword" : "password"
                }
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? "Hide password" : "Show password"
                    }
                    disabled={busy}
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={8}
                    className="min-w-11 min-h-11 items-center justify-center"
                  >
                    <AppIcon
                      name={showPassword ? "eye" : "eye-off"}
                      size={22}
                    />
                  </Pressable>
                }
              />
            )}
            {kind === "register" && (
              <View className="mb-5">
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consent }}
                  disabled={busy}
                  onPress={() => {
                    setConsent(!consent);
                    clearFieldError("consent");
                  }}
                  className="flex-row items-center gap-3 min-h-11"
                >
                  <View
                    className={`w-5 h-5 rounded-md border items-center justify-center ${consent ? "bg-ocean border-ocean" : "border-muted"}`}
                  >
                    {consent && <Text className="text-xs text-white">✓</Text>}
                  </View>
                  <Text className="text-xs text-ink flex-1">
                    I accept the Terms & Privacy Policy
                  </Text>
                </Pressable>
                {!!errors.consent && (
                  <Text
                    accessibilityRole="alert"
                    className="text-xs leading-5 text-ink mt-2"
                  >
                    {errors.consent}
                  </Text>
                )}
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push("/legal")}
                  className="self-start py-2 ml-8"
                >
                  <Text className="text-xs text-ocean underline">
                    Read terms and privacy policy
                  </Text>
                </Pressable>
              </View>
            )}
            {!!feedback && (
              <View
                accessibilityRole="alert"
                className={`rounded-xl p-4 mb-5 border ${feedback.success ? "bg-mint border-[#D9E5DC]" : "bg-[#FFF1E2] border-coral"}`}
              >
                <Text className="text-sm leading-5 text-ink">
                  {feedback.message}
                </Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled, busy }}
              disabled={disabled}
              onPress={() => void submit()}
              className="min-h-[56px] rounded-2xl bg-ocean flex-row items-center justify-center gap-3 px-5"
              style={({ pressed }) => ({
                opacity: busy ? 0.7 : disabled ? 0.5 : pressed ? 0.8 : 1,
              })}
            >
              {busy && <ActivityIndicator color="#FFFFFF" size="small" />}
              <Text className="text-sm font-bold tracking-[1px] text-white">
                {busy
                  ? "PLEASE WAIT…"
                  : kind === "login"
                    ? "LOGIN"
                    : kind === "register"
                      ? "SIGN UP"
                      : "SEND RESET LINK"}
              </Text>
            </Pressable>

            <View className="items-center mt-12 gap-1">
              {kind === "login" && (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => changeKind("reset")}
                  className="min-h-11 justify-center px-4"
                >
                  <Text className="text-sm text-ocean">Forgot Password?</Text>
                </Pressable>
              )}
              <View className="flex-row flex-wrap items-center justify-center">
                <Text className="text-xs text-muted">
                  {kind === "login"
                    ? "Don’t have an account?"
                    : "Already have an account?"}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() =>
                    changeKind(kind === "login" ? "register" : "login")
                  }
                  className="min-h-11 justify-center px-2"
                >
                  <Text className="text-xs font-bold text-ocean">
                    {kind === "login" ? "Sign Up" : "Log In"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

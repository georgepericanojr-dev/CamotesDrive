import { useState } from "react";
import { Text, View, Switch } from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Field,
  Heading,
  Row as DetailRow,
  Screen,
  VehicleCard,
} from "@/components/camotes/ui";
import {
  AsyncButton,
  ResourceState,
  SignInRequired,
} from "@/components/camotes/api-ui";
import { asRow, mapVehicle, text, type Row } from "@/data/models";
import { useApp } from "@/state/app";
import { supabase } from "@/lib/supabase";
import { photoUrl } from "@/lib/api";
import { pickUpload, signedFile } from "@/lib/uploads";
import { useResource } from "@/hooks/use-resource";
export function Saved() {
  const { signedIn } = useApp();
  const data = useResource<Row[]>(signedIn ? "/saved" : null);
  return (
    <Screen title="A few favorites" subtitle="Good rides worth coming back to.">
      <SignInRequired />
      <ResourceState {...data} retry={data.refresh} />
      <View className="flex-row flex-wrap gap-5">
        {data.data?.map((v) => (
          <View key={text(v.id)} style={{ width: 320, maxWidth: "100%" }}>
            <VehicleCard vehicle={mapVehicle(v, photoUrl)} />
          </View>
        ))}
      </View>
      {data.data?.length === 0 && (
        <Card>
          <Text className="text-muted">Save a ride to see it here.</Text>
        </Card>
      )}
    </Screen>
  );
}
export function Profile() {
  const {
    session,
    signedIn,
    profile,
    name,
    mode,
    modes,
    roles,
    setMode,
    mutate,
    toast,
    signOut,
  } = useApp();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [deleting, setDeleting] = useState(false);
  return (
    <Screen
      title="Your little island corner"
      subtitle="Your profile, verified roles, and preferences."
    >
      <SignInRequired />
      {signedIn && (
        <>
          <Card>
            <View className="flex-row gap-4 items-center mb-4">
              <Avatar />
              <View className="flex-1">
                <Text className="text-xl text-ink font-semibold">{name}</Text>
                <Text className="text-xs text-muted mt-2">
                  {session?.user.email}
                </Text>
              </View>
            </View>
            <Badge
              text={
                session?.user.email_confirmed_at
                  ? "EMAIL VERIFIED"
                  : "CHECK YOUR EMAIL TO VERIFY"
              }
            />
            {edit ? (
              <View className="mt-4">
                <Field
                  label="Full name"
                  value={draft}
                  onChangeText={setDraft}
                />
                <Field
                  label="Phone number"
                  value={phone}
                  onChangeText={setPhone}
                />
                <Field
                  label="Birth date for ID review (YYYY-MM-DD)"
                  value={dob}
                  onChangeText={setDob}
                />
                <AsyncButton
                  title="Save profile & accept terms/privacy"
                  disabled={!draft.trim() || !phone.trim()}
                  onPress={async () => {
                    await mutate("/me", {
                      full_name: draft,
                      phone,
                      submitted_date_of_birth: dob || undefined,
                      accept_terms: true,
                    });
                    setEdit(false);
                    toast(
                      "Profile saved. Birth date must be verified by document review.",
                    );
                  }}
                />
              </View>
            ) : (
              <DetailRow
                title="Personal information"
                detail="Edit"
                onPress={() => {
                  setDraft(name);
                  setPhone(text(profile.phone));
                  setDob(text(profile.submitted_date_of_birth));
                  setEdit(true);
                }}
              />
            )}
            <DetailRow
              title="Verification documents"
              onPress={() => router.push("/verification")}
            />
            <DetailRow
              title="Notification preferences"
              onPress={() => router.push("/settings")}
            />
          </Card>
          <Card>
            <Heading
              title="One account. More possibilities."
              sub="Provider modes unlock after administrator verification."
            />
            <View className="flex-row flex-wrap gap-2 mb-4">
              {modes.map((m) => (
                <AsyncButton
                  key={m}
                  title={`${m} mode`}
                  secondary={mode !== m}
                  onPress={async () => {
                    await setMode(m);
                    router.push(m === "Renter" ? "/" : "/provider");
                  }}
                />
              ))}
            </View>
            {roles.map((r) => (
              <DetailRow
                key={text(r.role)}
                title={text(r.role)}
                detail={text(r.status)}
              />
            ))}
            <View className="gap-3 mt-4">
              <AsyncButton
                secondary
                title="Request owner verification"
                onPress={async () => {
                  await mutate("/roles", { role: "owner" });
                  toast(
                    "Owner role requested. Submit your government ID for review.",
                  );
                }}
              />
              <AsyncButton
                secondary
                title="Request driver verification"
                onPress={async () => {
                  await mutate("/roles", { role: "driver" });
                  toast(
                    "Driver role requested. Submit a professional license and clearances.",
                  );
                }}
              />
            </View>
          </Card>
          <Card>
            <DetailRow
              title="Help & support"
              onPress={() => router.push("/support")}
            />
            <DetailRow
              title="Rental terms & privacy"
              onPress={() => router.push("/legal")}
            />
            <AsyncButton
              secondary
              title="Sign out"
              onPress={async () => {
                await signOut();
                router.replace("/auth");
              }}
            />
            <DetailRow
              title="Request account deletion"
              onPress={() => setDeleting(true)}
            />
            {deleting && (
              <View className="gap-3">
                <Text className="text-xs text-muted leading-5">
                  This sends an account deletion request for processing.
                  Booking, payment, and dispute records may require retention.
                  Active rentals must be resolved first.
                </Text>
                <AsyncButton
                  title="Submit deletion request"
                  onPress={async () => {
                    await mutate("/me/deletion-request", {});
                    setDeleting(false);
                    toast(
                      "Your account deletion request has been recorded for processing.",
                    );
                  }}
                />
                <Button
                  secondary
                  title="Keep account"
                  onPress={() => setDeleting(false)}
                />
              </View>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
export function Auth() {
  const { mutate, toast } = useApp();
  const [kind, setKind] = useState("Sign in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const redirect =
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ||
    Linking.createURL("auth/callback");
  return (
    <Screen
      title="Your island days start here"
      subtitle="Sign in securely with your email address."
      back
    >
      <Card>
        <View className="flex-row flex-wrap gap-2 mb-5">
          {["Sign in", "Register", "Reset password"].map((k) => (
            <Chip
              key={k}
              title={k}
              selected={kind === k}
              onPress={() => setKind(k)}
            />
          ))}
        </View>
        {kind === "Register" && (
          <Field label="Full name" value={name} onChangeText={setName} />
        )}
        <Field label="Email address" value={email} onChangeText={setEmail} />
        {kind !== "Reset password" && (
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        )}
        {kind === "Register" && (
          <View className="mb-4">
            <Chip
              title={
                consent
                  ? "✓ Terms & privacy accepted"
                  : "Accept Terms & Privacy Policy"
              }
              selected={consent}
              onPress={() => setConsent(!consent)}
            />
            <DetailRow
              title="Read terms and privacy policy"
              onPress={() => router.push("/legal")}
            />
          </View>
        )}
        <AsyncButton
          title={kind}
          disabled={
            !email.includes("@") ||
            (kind === "Register" && password.length < 8) ||
            (kind === "Sign in" && !password) ||
            (kind === "Register" && (!name.trim() || !consent))
          }
          onPress={async () => {
            if (kind === "Reset password") {
              const { error } = await supabase.auth.resetPasswordForEmail(
                email.trim(),
                { redirectTo: redirect },
              );
              if (error) throw error;
              toast("Check your email for a password reset link.");
              return;
            }
            if (kind === "Register") {
              const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                  emailRedirectTo: redirect,
                  data: { full_name: name },
                },
              });
              if (error) throw error;
              if (data.session) {
                await mutate("/me", { full_name: name, accept_terms: true });
                router.replace("/profile");
              } else
                toast(
                  "Check your email to verify your account, then sign in and complete your profile.",
                );
              return;
            }
            const { error } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (error) throw error;
            router.replace("/profile");
          }}
        />
      </Card>
    </Screen>
  );
}
export function AuthCallback() {
  const url = Linking.useURL();
  const { toast } = useApp();
  const [password, setPassword] = useState("");
  const [processed, setProcessed] = useState(false);
  const [recovery, setRecovery] = useState(false);
  return (
    <Screen title="Finish signing in" back>
      <Card>
        <Text className="text-sm text-muted mb-5">
          Open the confirmation or reset link on this device. Confirm the link
          below before continuing.
        </Text>
        {!processed ? (
          <AsyncButton
            title="Verify email link"
            onPress={async () => {
              const current = url || (await Linking.getInitialURL());
              if (!current) throw new Error("No confirmation link found");
              const parsed = new URL(current);
              const query = new URLSearchParams(parsed.search);
              const hash = new URLSearchParams(parsed.hash.slice(1));
              const error =
                query.get("error_description") || hash.get("error_description");
              if (error) throw new Error(error);
              const code = query.get("code");
              if (code) {
                const { error } =
                  await supabase.auth.exchangeCodeForSession(code);
                if (error) throw error;
              } else if (
                hash.get("access_token") &&
                hash.get("refresh_token")
              ) {
                const { error } = await supabase.auth.setSession({
                  access_token: hash.get("access_token")!,
                  refresh_token: hash.get("refresh_token")!,
                });
                if (error) throw error;
              } else
                throw new Error(
                  "This link is invalid or has already been used",
                );
              setProcessed(true);
              setRecovery(
                hash.get("type") === "recovery" ||
                  query.get("type") === "recovery",
              );
              toast("Email link verified.");
            }}
          />
        ) : (
          <>
            <Field
              label="New password (for password reset)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <AsyncButton
              title="Set new password"
              disabled={password.length < 8}
              onPress={async () => {
                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
                router.replace("/profile");
              }}
            />
            {!recovery && (
              <View className="mt-3">
                <Button
                  secondary
                  title="Continue to profile"
                  onPress={() => router.replace("/profile")}
                />
              </View>
            )}
          </>
        )}
      </Card>
    </Screen>
  );
}
export function Verification() {
  const { signedIn, roles, ownedVehicles, mutate, toast } = useApp();
  const data = useResource<Row[]>(signedIn ? "/documents" : null);
  const [kind, setKind] = useState("government_id");
  const [vehicle, setVehicle] = useState("");
  const [issued, setIssued] = useState("");
  const [expiry, setExpiry] = useState("");
  const [reference, setReference] = useState("");
  const [plate, setPlate] = useState("");
  const [consent, setConsent] = useState(false);
  const [path, setPath] = useState("");
  const vehicleDocument = [
    "or_cr",
    "ctpl_insurance",
    "ltfrb_authority",
    "passenger_insurance",
  ].includes(kind);
  const available = [
    "government_id",
    "drivers_license",
    ...(roles.some((r) => r.role === "driver")
      ? ["professional_license", "nbi_clearance", "pnp_clearance"]
      : []),
    ...(roles.some((r) => r.role === "owner")
      ? [
          "or_cr",
          "ctpl_insurance",
          "ltfrb_authority",
          "passenger_insurance",
          "business_permit",
          "dti_sec_registration",
        ]
      : []),
  ];
  return (
    <Screen
      title="Trust starts here"
      subtitle="Documents are private and reviewed by an administrator."
      back
    >
      <SignInRequired />
      {signedIn && (
        <>
          <ResourceState {...data} retry={data.refresh} />
          {data.data?.map((d) => (
            <Card key={text(d.id)}>
              <Badge text={text(d.status).toUpperCase()} />
              <DetailRow
                title={text(d.document_type)}
                detail={text(d.expires_on) || "No expiry provided"}
              />
              {!!d.rejection_reason && (
                <Text className="text-xs text-muted mb-3">
                  {text(d.rejection_reason)}
                </Text>
              )}
              <AsyncButton
                secondary
                title="Open private document"
                onPress={async () =>
                  Linking.openURL(
                    await signedFile(
                      "verification-documents",
                      text(d.storage_path),
                    ),
                  )
                }
              />
            </Card>
          ))}
          <Card>
            <Heading
              title="Submit a document"
              sub="Use a clear image or PDF. License restrictions and date of birth are verified by review."
            />
            <View className="flex-row flex-wrap gap-2 mb-4">
              {available.map((k) => (
                <Chip
                  key={k}
                  title={k.replaceAll("_", " ")}
                  selected={kind === k}
                  onPress={() => {
                    setKind(k);
                    setPath("");
                  }}
                />
              ))}
            </View>
            {vehicleDocument && (
              <View className="gap-2 mb-4">
                {ownedVehicles.map((v) => (
                  <Chip
                    key={text(v.id)}
                    title={text(v.name)}
                    selected={vehicle === v.id}
                    onPress={() => setVehicle(text(v.id))}
                  />
                ))}
              </View>
            )}
            <Field
              label="Reference / case number"
              value={reference}
              onChangeText={setReference}
            />
            {vehicleDocument && (
              <Field
                label="Vehicle plate number"
                value={plate}
                onChangeText={setPlate}
              />
            )}
            <Field
              label="Issue date (YYYY-MM-DD)"
              value={issued}
              onChangeText={setIssued}
            />
            <Field
              label="Expiry date (YYYY-MM-DD, if applicable)"
              value={expiry}
              onChangeText={setExpiry}
            />
            <Chip
              title={
                consent
                  ? "✓ I consent to document processing"
                  : "I consent to document processing"
              }
              selected={consent}
              onPress={() => setConsent(!consent)}
            />
            <View className="gap-3 mt-4">
              <AsyncButton
                secondary
                title={
                  path
                    ? "✓ File uploaded · choose another"
                    : "Choose & upload private file"
                }
                disabled={!consent}
                onPress={async () => {
                  const p = await pickUpload("verification-documents");
                  if (p) setPath(p);
                }}
              />
              <AsyncButton
                title="Submit for review"
                disabled={!path || !consent || (vehicleDocument && !vehicle)}
                onPress={async () => {
                  await mutate("/documents", {
                    document_type: kind,
                    vehicle_id: vehicleDocument ? vehicle : undefined,
                    storage_path: path,
                    reference_number: reference || undefined,
                    plate_number: plate || undefined,
                    issued_on: issued || undefined,
                    expires_on: expiry || undefined,
                    license_kind:
                      kind === "professional_license"
                        ? "professional"
                        : kind === "drivers_license"
                          ? "non_professional"
                          : undefined,
                    consent,
                  });
                  setPath("");
                  data.refresh();
                  toast("Document submitted for review.");
                }}
              />
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}
export function Settings() {
  const { profile, signedIn, mutate, toast } = useApp();
  const prefs = asRow(profile.notification_preferences);
  return (
    <Screen title="Your preferences" back>
      <SignInRequired />
      {signedIn && (
        <Card>
          {["bookings", "messages", "documents"].map((key) => (
            <View
              key={key}
              className="flex-row items-center justify-between py-4"
            >
              <Text className="text-ink text-sm">
                {key[0].toUpperCase() + key.slice(1)} notifications
              </Text>
              <Switch
                accessibilityLabel={`${key} notifications`}
                value={prefs[key] !== false}
                onValueChange={(value) => {
                  void mutate("/me", {
                    notification_preferences: { ...prefs, [key]: value },
                  }).catch((error: Error) => toast(error.message));
                }}
                trackColor={{ true: "#164E43" }}
              />
            </View>
          ))}
          <DetailRow title="Language" detail="English" />
          <DetailRow title="Currency / timezone" detail="PHP · Asia/Manila" />
          <Text className="text-xs text-muted leading-5 mt-4">
            Preferences are saved to your account. Push delivery requires a
            configured notification worker.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

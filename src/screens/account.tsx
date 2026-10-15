import { useState } from "react";
import { Text, View, Switch, Platform } from "react-native";
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
import { asRow, manilaDate, mapVehicle, text, type Row } from "@/data/models";
import { useApp } from "@/state/app";
import { supabase } from "@/lib/supabase";
import { photoUrl } from "@/lib/api";
import { pickUpload, signedFile } from "@/lib/uploads";
import { useResource } from "@/hooks/use-resource";
import { SignOutButton } from "@/components/camotes/sign-out-button";
import { renterHomeHref } from "@/lib/navigation";
import { DateField } from "@/components/camotes/date-field";
import { isDateOnly } from "@/lib/date-only";
import { VerificationGuide } from "@/components/camotes/verification-guide";
import {
  DOCUMENT_GUIDE,
  documentLabel,
  VERIFICATION_GOALS,
  type VerificationGoal,
} from "@/lib/verification-guide";
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
                <DateField
                  label="Birth date for ID review"
                  value={dob}
                  onChangeText={setDob}
                  maximumDate={manilaDate()}
                  optional
                  helperText="Your birth date is confirmed during document review."
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
              detail="See checklist"
              onPress={() => router.push("/verification")}
            />
            <DetailRow
              title="Notification preferences"
              onPress={() => router.push("/settings")}
            />
            {Platform.OS === "web" &&
              roles.some(
                (role) => role.role === "admin" && role.status === "active",
              ) && (
                <DetailRow
                  title="Admin dashboard"
                  detail="Open"
                  onPress={() => router.push("/admin")}
                />
              )}
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
                    router.push(m === "Renter" ? renterHomeHref : "/provider");
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
            <SignOutButton />
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
  const { signedIn, roles, mode, ownedVehicles, mutate, toast } = useApp();
  const data = useResource<Row[]>(signedIn ? "/documents" : null);
  const [goal, setGoal] = useState<VerificationGoal>(
    mode === "Driver"
      ? "driver"
      : mode === "Owner"
        ? "owner"
        : "renter_self_drive",
  );
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
  const noExpiryAllowed = [
    "government_id",
    "or_cr",
    "dti_sec_registration",
  ].includes(kind);
  const selectKind = (next: string) => {
    if (next === kind) return;
    setKind(next);
    setPath("");
    setIssued("");
    setExpiry("");
    setReference("");
    setPlate("");
  };
  const available = [
    ...new Set([
      "government_id",
      "drivers_license",
      ...VERIFICATION_GOALS[goal].documents,
      ...(roles.some((r) => r.role === "driver")
        ? ["professional_license", "nbi_clearance", "pnp_clearance"]
        : []),
      ...(goal === "owner" || roles.some((r) => r.role === "owner")
        ? [
            "or_cr",
            "ctpl_insurance",
            "ltfrb_authority",
            "passenger_insurance",
            "business_permit",
            "dti_sec_registration",
          ]
        : []),
    ]),
  ];
  return (
    <Screen
      title="Verify your account"
      subtitle="See what you need, upload each document, then submit it for administrator review. Your files stay private."
      back
    >
      <SignInRequired />
      {signedIn && (
        <>
          <ResourceState {...data} retry={data.refresh} />
          <VerificationGuide
            goal={goal}
            onGoal={(next) => {
              setGoal(next);
              selectKind(VERIFICATION_GOALS[next].documents[0]);
            }}
            documents={data.data || []}
            loading={data.loading}
            error={data.error}
            vehicles={ownedVehicles}
            vehicle={vehicle}
            onVehicle={(id) => {
              setVehicle(id);
              setPath("");
              setReference("");
              setPlate("");
              setIssued("");
              setExpiry("");
            }}
          />
          <Card>
            <Heading
              title="Submit a document"
              sub="1. Select a document type. 2. Add its details. 3. Choose a file and submit for review."
            />
            <Text className="text-sm font-semibold text-ink mb-2">
              1. What are you uploading?
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {available.map((k) => (
                <Chip
                  key={k}
                  title={documentLabel(k)}
                  selected={kind === k}
                  onPress={() => selectKind(k)}
                />
              ))}
            </View>
            <View className="bg-mint rounded-2xl p-4 mb-4">
              <Text className="text-sm font-semibold text-ocean mb-2">
                {documentLabel(kind)}
              </Text>
              <Text className="text-sm text-ink leading-6">
                {DOCUMENT_GUIDE[kind]?.help}
              </Text>
              <Text className="text-xs text-muted mt-3 leading-5">
                Accepted: JPG, PNG, WebP or PDF, up to 10 MB per file. Keep all
                edges visible and avoid blur, glare or covered details. If both
                sides or several pages are needed, combine them in one PDF or
                image.
              </Text>
            </View>
            <Text className="text-sm font-semibold text-ink mb-3">
              2. Document details
            </Text>
            {vehicleDocument && (
              <View className="gap-2 mb-4">
                <Text className="text-xs font-semibold text-ink">
                  Which vehicle is this for? (required)
                </Text>
                {ownedVehicles.length === 0 && (
                  <Text className="text-sm text-muted">
                    Save a vehicle draft in Provider → Vehicles first. You can
                    then select it here.
                  </Text>
                )}
                {ownedVehicles.map((v) => (
                  <Chip
                    key={text(v.id)}
                    title={text(v.name)}
                    selected={vehicle === v.id}
                    onPress={() => {
                      setVehicle(text(v.id));
                      setPath("");
                      setReference("");
                      setPlate("");
                      setIssued("");
                      setExpiry("");
                    }}
                  />
                ))}
              </View>
            )}
            <Field
              label="Document / reference number (if shown)"
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
            <DateField
              label="Issue date (if shown)"
              value={issued}
              onChangeText={setIssued}
              maximumDate={isDateOnly(expiry) ? expiry : undefined}
              optional
            />
            <DateField
              label={
                noExpiryAllowed
                  ? "Expiry date (if shown)"
                  : "Expiry date (required)"
              }
              value={expiry}
              onChangeText={setExpiry}
              minimumDate={issued > manilaDate() ? issued : manilaDate()}
              optional={noExpiryAllowed}
              helperText={
                noExpiryAllowed
                  ? "Enter the printed expiry date. Leave empty only if this document has no expiry."
                  : "Enter the expiry date printed on your document. It must be valid today and for your trip dates."
              }
            />
            {!!issued && !!expiry && issued > expiry && (
              <Text className="text-red-700 text-xs mb-4">
                The expiry date must be on or after the issue date.
              </Text>
            )}
            <Chip
              title={
                consent
                  ? "✓ I consent to document processing"
                  : "I consent to document processing"
              }
              selected={consent}
              onPress={() => setConsent(!consent)}
            />
            <Text className="text-sm font-semibold text-ink mt-5 mb-2">
              3. Upload and submit
            </Text>
            <Text className="text-xs text-muted leading-5">
              Give consent above to choose a file. After uploading, tap “Submit
              for review” to send it to an administrator. Repeat for each item
              in your checklist.
            </Text>
            <View className="gap-3 mt-4">
              <AsyncButton
                secondary
                title={
                  path
                    ? "✓ File ready · choose another"
                    : "Choose & upload private file"
                }
                disabled={!consent || (vehicleDocument && !vehicle)}
                onPress={async () => {
                  const p = await pickUpload("verification-documents");
                  if (p) setPath(p);
                }}
              />
              <AsyncButton
                title="Submit for review"
                disabled={
                  !path ||
                  !consent ||
                  (vehicleDocument && !vehicle) ||
                  (!noExpiryAllowed && !isDateOnly(expiry)) ||
                  (!!expiry && expiry < manilaDate()) ||
                  (!!issued && !!expiry && issued > expiry)
                }
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
                  toast(
                    "Document submitted. Check your checklist for review status and upload the remaining documents.",
                  );
                }}
              />
            </View>
          </Card>
          <Heading
            title="Your submitted documents"
            sub="In review means your document is waiting for an administrator. If rejected, read the reason and upload a corrected copy."
          />
          {!data.loading && !data.error && data.data?.length === 0 && (
            <Card>
              <Text className="text-sm text-muted">
                No documents submitted yet. Start with your checklist above.
              </Text>
            </Card>
          )}
          {data.data?.map((d) => (
            <Card key={text(d.id)}>
              <Badge
                text={
                  text(d.status) === "pending"
                    ? "IN REVIEW"
                    : text(d.status).toUpperCase()
                }
              />
              <DetailRow
                title={documentLabel(text(d.document_type))}
                detail={
                  text(d.expires_on)
                    ? `Expires ${text(d.expires_on)}`
                    : "No expiry provided"
                }
              />
              {!!d.vehicle_id && (
                <Text className="text-xs text-muted mb-3">
                  Vehicle:{" "}
                  {text(
                    ownedVehicles.find((v) => v.id === d.vehicle_id)?.name,
                  ) || "Vehicle record unavailable"}
                </Text>
              )}
              {!!d.rejection_reason && (
                <Text className="text-sm text-ink mb-3">
                  Reason: {text(d.rejection_reason)}
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

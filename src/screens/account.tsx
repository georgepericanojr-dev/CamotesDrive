import { useState } from "react";
import { Text, View, Switch } from "react-native";
import { router } from "expo-router";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Field,
  Heading,
  Row,
  Screen,
  VehicleCard,
} from "@/components/camotes/ui";
import { vehicles, type Mode } from "@/data/mock";
import { useDemo } from "@/state/demo";
export function Saved() {
  const { favorites } = useDemo();
  return (
    <Screen title="A few favorites" subtitle="Good rides worth coming back to.">
      <View className="flex-row flex-wrap gap-5">
        {vehicles
          .filter((v) => favorites.includes(v.id))
          .map((v) => (
            <View key={v.id} style={{ width: 320, maxWidth: "100%" }}>
              <VehicleCard vehicle={v} />
            </View>
          ))}
      </View>
      {!favorites.length && (
        <Card>
          <Text className="text-muted mb-4">
            Tap the heart on a ride to save it here.
          </Text>
          <Button title="Explore vehicles" onPress={() => router.push("/")} />
        </Card>
      )}
    </Screen>
  );
}
export function Profile() {
  const { name, setName, mode, setMode, toast, setSignedIn } = useDemo();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(name);
  const [phone, setPhone] = useState("+63 917 000 0000");
  const [deleting, setDeleting] = useState(false);
  return (
    <Screen
      title="Your little island corner"
      subtitle="Manage your profile and choose how you explore."
    >
      <Card>
        <View className="flex-row gap-4 items-center mb-5">
          <Avatar />
          <View>
            <Text className="text-xl font-semibold text-ink">{name}</Text>
            <Text className="text-xs text-muted mt-2">
              alex@example.com · Email verified
            </Text>
          </View>
        </View>
        <Badge text="✓ VERIFIED DEMO ACCOUNT" />
        {edit ? (
          <View className="mt-4">
            <Field label="Full name" value={draft} onChangeText={setDraft} />
            <Field label="Phone number" value={phone} onChangeText={setPhone} />
            <Button
              title="Save profile"
              disabled={!draft.trim()}
              onPress={() => {
                setName(draft);
                setEdit(false);
                toast("Profile updated for this session.");
              }}
            />
          </View>
        ) : (
          <Row
            title="Personal information"
            detail="Edit"
            onPress={() => setEdit(true)}
          />
        )}
        <Row
          title="Verification documents"
          detail="Approved"
          onPress={() => router.push("/verification")}
        />
        <Row
          title="Notifications & preferences"
          onPress={() => router.push("/settings")}
        />
      </Card>
      <Card>
        <Heading
          title="One account. More possibilities."
          sub="This demo account has verified owner and driver roles."
        />
        <View className="flex-row flex-wrap gap-3">
          {(["Renter", "Owner", "Driver"] as Mode[]).map((m) => (
            <Chip
              key={m}
              title={`${m} mode`}
              selected={mode === m}
              onPress={() => {
                setMode(m);
                router.push(m === "Renter" ? "/" : "/provider");
              }}
            />
          ))}
        </View>
        <Row
          title="Become a vehicle owner or driver"
          detail="View requirements"
          onPress={() => router.push("/verification")}
        />
      </Card>
      <Card>
        <Row title="Help & support" onPress={() => router.push("/support")} />
        <Row
          title="Privacy policy & rental terms"
          onPress={() => router.push("/legal")}
        />
        <Row
          title="Sign out"
          onPress={() => {
            setSignedIn(false);
            router.push("/auth");
          }}
        />
        <Row title="Delete account" onPress={() => setDeleting(true)} />
        {deleting && (
          <View className="gap-3 mt-4">
            <Text className="text-xs text-muted leading-5">
              Your profile and saved rides would be deleted. Booking, payment,
              and dispute records may be retained for legal requirements. This
              demo only signs you out.
            </Text>
            <Button
              title="Confirm demo account deletion"
              onPress={() => {
                setSignedIn(false);
                router.replace("/auth");
                toast("Demo account signed out. No real records were deleted.");
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
    </Screen>
  );
}
export function Auth() {
  const { setSignedIn, toast } = useDemo();
  const [kind, setKind] = useState("Sign in");
  const [email, setEmail] = useState("alex@example.com");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  return (
    <Screen
      title="Your island days start here"
      subtitle="Welcome to CamotesDrive. This is a mock sign-in flow."
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
          </View>
        )}
        <Button
          title={kind}
          disabled={
            !email.includes("@") ||
            (kind !== "Reset password" && password.length < 6) ||
            (kind === "Register" && (!name.trim() || !consent))
          }
          onPress={() => {
            if (kind === "Reset password")
              toast("Demo reset email sent. No actual email is sent.");
            else {
              setSignedIn(true);
              toast(
                kind === "Register"
                  ? "Demo registration complete. Email verified for preview."
                  : "Welcome back to the island.",
              );
              router.replace("/");
            }
          }}
        />
      </Card>
    </Screen>
  );
}
export function Verification() {
  const { toast, mode } = useDemo();
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const docs =
    mode === "Driver"
      ? [
          "Professional driver’s license",
          "Government ID",
          "NBI clearance",
          "PNP clearance",
        ]
      : mode === "Owner"
        ? [
            "Government ID",
            "OR / CR",
            "CTPL insurance",
            "Business permit (fleet owners)",
            "DTI / SEC registration (fleet owners)",
          ]
        : ["Driver’s license", "Government ID"];
  return (
    <Screen
      title="Trust starts here"
      subtitle="Your documents stay private. This screen uses sample documents only."
      back
    >
      <Card>
        <Badge text="CURRENT DEMO PROFILE: APPROVED" />
        <View className="mt-5">
          <Heading
            title={`${mode} verification`}
            sub="Renewals require admin review. Driver Mode requires a professional license. Non-professional licenses are not accepted for driver verification."
          />
        </View>
        <Chip
          title={
            consent
              ? "✓ Document processing consent given"
              : "I consent to ID & license processing"
          }
          selected={consent}
          onPress={() => setConsent(!consent)}
        />
        {docs.map((doc) => (
          <Row
            key={doc}
            title={doc}
            detail={
              uploaded.includes(doc)
                ? "Sample attached"
                : "Approved · expires Oct 2027"
            }
            onPress={() => {
              if (!consent) {
                toast("Please give document processing consent first.");
                return;
              }
              setUploaded((old) => [...old.filter((x) => x !== doc), doc]);
            }}
          />
        ))}
        <View className="mt-5">
          <Button
            title="Submit sample renewal for review"
            disabled={!uploaded.length}
            onPress={() =>
              toast("Sample documents submitted. Status: pending admin review.")
            }
          />
        </View>
        <Text className="text-xs text-muted leading-5 mt-4">
          Tap a document to simulate attaching a renewal. No camera, file
          upload, or storage is connected.
        </Text>
      </Card>
    </Screen>
  );
}
export function Settings() {
  const [push, setPush] = useState(true);
  const [messages, setMessages] = useState(true);
  const [biometric, setBiometric] = useState(false);
  return (
    <Screen title="Your preferences" back>
      <Card>
        {[
          ["Booking reminders", push, setPush],
          ["Message notifications", messages, setMessages],
          ["Biometric unlock (demo)", biometric, setBiometric],
        ].map(([label, value, setter]) => (
          <View
            key={String(label)}
            className="flex-row justify-between items-center py-4"
          >
            <Text className="text-ink text-sm flex-1">{String(label)}</Text>
            <Switch
              accessibilityLabel={String(label)}
              value={Boolean(value)}
              onValueChange={setter as (v: boolean) => void}
              trackColor={{ true: "#164E43", false: "#DCE3DA" }}
            />
          </View>
        ))}
        <Row title="Language" detail="English" />
        <Row title="Currency / timezone" detail="PHP · Asia/Manila" />
        <Row title="App version" detail="1.0.0 · Demo" />
      </Card>
    </Screen>
  );
}

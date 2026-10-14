import { useState } from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  View,
  Pressable,
  Switch,
} from "react-native";
import {
  Badge,
  Brand,
  Button,
  Card,
  Chip,
  Field,
  Heading,
  Row,
} from "@/components/camotes/ui";
import { useDemo } from "@/state/demo";
import { money, vehicles } from "@/data/mock";

// A web-only UI prototype, deliberately separate from mobile navigation.
export default function Admin() {
  const { chauffeur, setChauffeur, trips, updateTrip } = useDemo();
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("admin@camotesdrive.demo");
  const [code, setCode] = useState("");
  const [tab, setTab] = useState("Overview");
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [audit, setAudit] = useState<string[]>([]);
  const [accreditation, setAccreditation] = useState("");
  const [expiry, setExpiry] = useState("2026-12-31");
  const [serviceFee, setServiceFee] = useState("5");
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [mfa, setMfa] = useState(false);
  const log = (message: string) =>
    setAudit((a) => [`Oct 15, 2026 · Admin demo · ${message}`, ...a]);
  const decide = (id: string, status: string) => {
    setDecisions((d) => ({ ...d, [id]: status }));
    log(`${id}: ${status}${reason ? ` — ${reason}` : ""}`);
  };
  if (Platform.OS !== "web")
    return (
      <View className="flex-1 bg-sand p-10 justify-center">
        <Text className="text-ink text-lg">
          The admin panel is available on the web only.
        </Text>
      </View>
    );
  return (
    <SafeAreaView className="flex-1 bg-sand">
      <ScrollView
        contentContainerStyle={{
          padding: 30,
          maxWidth: 1280,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View className="flex-row justify-between items-center mb-8">
          <Brand />
          <Badge text="ADMIN WEB · MOCK DATA" />
        </View>
        {!signedIn ? (
          <View className="max-w-lg w-full self-center mt-12">
            <Card>
              <Heading
                title="Your island, in good hands"
                sub="Admin sign-in preview. Mock MFA code: 123456. No real authentication or authorization is connected."
              />
              <Field
                label="Admin email"
                value={email}
                onChangeText={setEmail}
              />
              {mfa && (
                <Field
                  label="Multi-factor verification code"
                  value={code}
                  onChangeText={setCode}
                />
              )}
              <Button
                title={
                  mfa ? "Verify & enter demo admin" : "Continue to mock MFA"
                }
                disabled={
                  !email.endsWith("@camotesdrive.demo") ||
                  (mfa && code !== "123456")
                }
                onPress={() => (mfa ? setSignedIn(true) : setMfa(true))}
              />
            </Card>
          </View>
        ) : (
          <>
            <View className="flex-row flex-wrap gap-2 mb-7">
              {[
                "Overview",
                "Users",
                "Verification",
                "Listings",
                "Bookings",
                "Payments",
                "Compliance",
                "Disputes",
                "Reviews",
                "Settings",
                "Audit log",
              ].map((t) => (
                <Chip
                  key={t}
                  title={t}
                  selected={tab === t}
                  onPress={() => setTab(t)}
                />
              ))}
              <Pressable onPress={() => setSignedIn(false)} className="p-3">
                <Text className="text-muted text-xs">Sign out</Text>
              </Pressable>
            </View>
            <Heading
              title={tab}
              sub="All actions are local preview actions; no real account, payment, or approval is affected."
            />
            {tab === "Overview" && (
              <>
                <View className="flex-row flex-wrap gap-4 mb-6">
                  {[
                    ["128", "Verified users"],
                    ["34", "Active vehicles"],
                    ["86", "October bookings"],
                    ["₱142,800", "Rental volume"],
                  ].map(([v, label]) => (
                    <View
                      key={label}
                      className="bg-white rounded-3xl border border-[#E1E6DA] p-7 flex-1 min-w-[160px]"
                    >
                      <Text className="text-3xl text-ocean font-semibold">
                        {v}
                      </Text>
                      <Text className="text-xs text-muted mt-3">{label}</Text>
                    </View>
                  ))}
                </View>
                <Card>
                  <Heading title="This week on the island" />
                  <View className="flex-row items-end gap-4 h-40">
                    {[38, 70, 58, 100, 85, 126, 112].map((h, i) => (
                      <View key={i} className="flex-1 items-center">
                        <View
                          className="bg-ocean rounded-t-lg w-full"
                          style={{ height: h }}
                        />
                        <Text className="text-xs text-muted mt-2">
                          {["M", "T", "W", "T", "F", "S", "S"][i]}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Card>
                <Card>
                  <Row
                    title="Pending document reviews"
                    detail="7"
                    onPress={() => setTab("Verification")}
                  />
                  <Row
                    title="Payments awaiting confirmation"
                    detail="4"
                    onPress={() => setTab("Payments")}
                  />
                  <Row
                    title="Expiring provider documents"
                    detail="3"
                    onPress={() => setTab("Compliance")}
                  />
                  <Row
                    title="Open disputes"
                    detail="2"
                    onPress={() => setTab("Disputes")}
                  />
                </Card>
              </>
            )}
            {tab === "Users" &&
              [
                "Alex Morgan · Renter",
                "Miguel Santos · Owner",
                "Ramon Cruz · Driver",
              ].map((u) => (
                <Card key={u}>
                  <Heading title={u} />
                  <Badge text={decisions[u] || "ACTIVE"} />
                  <View className="mt-4">
                    <Button
                      secondary
                      title={
                        decisions[u] === "SUSPENDED"
                          ? "Reactivate user"
                          : "Suspend user"
                      }
                      onPress={() =>
                        decide(
                          u,
                          decisions[u] === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                        )
                      }
                    />
                  </View>
                </Card>
              ))}
            {tab === "Verification" && (
              <Card>
                <Heading
                  title="Ramon Cruz · Driver renewal"
                  sub="Professional license expires Oct 2027. Plate DEMO 1028 matches OR/CR. Every required item must pass before approval."
                />
                {[
                  "Professional license",
                  "Government ID",
                  "NBI clearance",
                  "PNP clearance",
                  "Expiry dates valid",
                  "Annual re-verification",
                ].map((d) => (
                  <Row
                    key={d}
                    title={d}
                    detail={checked.includes(d) ? "✓ Passed" : "Review sample"}
                    onPress={() =>
                      setChecked((c) =>
                        c.includes(d) ? c.filter((x) => x !== d) : [...c, d],
                      )
                    }
                  />
                ))}
                <Field
                  label="Review / rejection reason"
                  value={reason}
                  onChangeText={setReason}
                />
                <Badge text={decisions.Ramon || "PENDING"} />
                <View className="gap-3 mt-4">
                  <Button
                    title="Approve verification"
                    disabled={checked.length !== 6}
                    onPress={() => decide("Ramon", "APPROVED")}
                  />
                  <Button
                    secondary
                    title="Reject with reason"
                    disabled={!reason.trim()}
                    onPress={() => decide("Ramon", "REJECTED")}
                  />
                </View>
              </Card>
            )}
            {tab === "Listings" &&
              vehicles.map((v) => (
                <Card key={v.id}>
                  <Heading
                    title={v.name}
                    sub={`${v.owner} · ${money(v.price)} / day · Self-drive`}
                  />
                  <Badge text={decisions[v.id] || "PENDING REVIEW"} />
                  <Row
                    title="Registration & CTPL insurance"
                    detail="Valid sample documents"
                  />
                  <View className="gap-3 mt-4">
                    <Button
                      title="Approve sample listing"
                      onPress={() => decide(v.id, "APPROVED")}
                    />
                    <Button
                      secondary
                      title="Suspend listing"
                      onPress={() => decide(v.id, "SUSPENDED")}
                    />
                  </View>
                </Card>
              ))}
            {(tab === "Bookings" || tab === "Payments") &&
              trips.map((t) => (
                <Card key={t.id}>
                  <Heading
                    title={t.id}
                    sub={`${t.status} · ${t.payment} · ${t.method}`}
                  />
                  <Row
                    title="Renter / vehicle"
                    detail={`Alex · ${vehicles.find((v) => v.id === t.vehicleId)?.name}`}
                  />
                  <Row
                    title="Payment reference"
                    detail={t.reference || "Not submitted"}
                  />
                  <Button
                    title={
                      tab === "Payments"
                        ? "Record demo payment confirmation"
                        : "Flag booking for review"
                    }
                    onPress={() => {
                      if (tab === "Payments")
                        updateTrip(t.id, { payment: "Paid" });
                      log(
                        `${t.id}: ${tab === "Payments" ? "Payment confirmed" : "Flagged for review"}`,
                      );
                    }}
                  />
                </Card>
              ))}
            {tab === "Compliance" && (
              <>
                <Card>
                  <Heading
                    title="Platform TNC accreditation"
                    sub="Chauffeured service is hidden unless the demo accreditation is recorded and unexpired. These are fictional details only."
                  />
                  <Field
                    label="Accreditation number (demo)"
                    value={accreditation}
                    onChangeText={setAccreditation}
                  />
                  <Field
                    label="Valid until (YYYY-MM-DD)"
                    value={expiry}
                    onChangeText={setExpiry}
                  />
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-ink">
                      Enable chauffeured demo preview
                    </Text>
                    <Switch
                      value={chauffeur}
                      disabled={
                        !accreditation.trim() ||
                        !/^\d{4}-\d{2}-\d{2}$/.test(expiry) ||
                        !Number.isFinite(Date.parse(expiry)) ||
                        expiry <= "2026-10-24"
                      }
                      onValueChange={(v) => {
                        setChauffeur(v);
                        log(`Chauffeured demo flag: ${v}`);
                      }}
                    />
                  </View>
                </Card>
                <Card>
                  <Heading title="Expiry watch" />
                  <Row
                    title="Miguel · Passenger insurance"
                    detail="30 days remaining"
                  />
                  <Row title="Ana · CTPL insurance" detail="7 days remaining" />
                  <Row
                    title="Carlo · Expired license"
                    detail="New bookings blocked"
                  />
                  <Row
                    title="Affected confirmed bookings"
                    detail="1 · Requires review"
                  />
                </Card>
              </>
            )}
            {tab === "Disputes" && (
              <Card>
                <Heading
                  title="DSP-001 · Security deposit"
                  sub="Renter disputes a ₱1,500 withholding. Sample handover evidence attached."
                />
                <Field
                  label="Resolution notes"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                />
                <Badge text={decisions.dispute || "OPEN"} />
                <View className="mt-4">
                  <Button
                    title="Resolve & record deposit return"
                    disabled={!reason.trim()}
                    onPress={() =>
                      decide("dispute", "RESOLVED · DEPOSIT RETURNED")
                    }
                  />
                </View>
              </Card>
            )}
            {tab === "Reviews" && (
              <Card>
                <Heading
                  title="Jamie L. · Toyota Fortuner · 5 stars"
                  sub="Easy pickup, lovely local owner!"
                />
                <Badge text={decisions.review || "PUBLISHED"} />
                <View className="mt-4">
                  <Button
                    secondary
                    title="Hide flagged review"
                    onPress={() => decide("review", "HIDDEN")}
                  />
                </View>
              </Card>
            )}
            {tab === "Settings" && (
              <Card>
                <Field
                  label="Service fee (%)"
                  value={serviceFee}
                  onChangeText={setServiceFee}
                />
                <Row title="Cancellation window" detail="48 hours" />
                <Row title="Provider response window" detail="24 hours" />
                <Row title="Minimum app version" detail="1.0.0" />
                <Row
                  title="Pickup points"
                  detail="Consuelo · Poro · Santiago"
                />
                <Button
                  title="Save demo settings"
                  disabled={
                    !Number.isFinite(Number(serviceFee)) ||
                    Number(serviceFee) < 0 ||
                    Number(serviceFee) > 100
                  }
                  onPress={() =>
                    log(
                      `Settings saved: service fee ${serviceFee}% (preview only)`,
                    )
                  }
                />
              </Card>
            )}
            {tab === "Audit log" && (
              <Card>
                {audit.length ? (
                  audit.map((a, i) => <Row key={i} title={a} />)
                ) : (
                  <Text className="text-muted text-sm">
                    Actions you take in the demo will appear here.
                  </Text>
                )}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

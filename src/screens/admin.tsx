import { useEffect, useState } from "react";
import { Image, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { randomUUID } from "expo-crypto";
import {
  Badge,
  Brand,
  Button,
  Card,
  Chip,
  Field,
  Heading,
  Row as DetailRow,
} from "@/components/camotes/ui";
import { AsyncButton, ResourceState } from "@/components/camotes/api-ui";
import { asRow, number, rows, text, type Row as DataRow } from "@/data/models";
import { useApp } from "@/state/app";
import { supabase } from "@/lib/supabase";
import { signedFile } from "@/lib/uploads";
import { useResource } from "@/hooks/use-resource";
export default function Admin() {
  const { session, roles, mutate, toast } = useApp();
  const admin = roles.some((r) => r.role === "admin" && r.status === "active");
  const [verified, setVerified] = useState(false);
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [section, setSection] = useState("overview");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<DataRow | null>(null);
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState("");
  const [reference, setReference] = useState("");
  const [plate, setPlate] = useState("");
  const [dob, setDob] = useState("");
  const [classes, setClasses] = useState("");
  const [withDriver, setWithDriver] = useState(false);
  const [fee, setFee] = useState("");
  const [issued, setIssued] = useState("");
  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState("");
  const [payoutKey, setPayoutKey] = useState(() => randomUUID());
  const [refundKey, setRefundKey] = useState(() => randomUUID());
  const [refundReference, setRefundReference] = useState("");
  const [professionalVerified, setProfessionalVerified] = useState(false);
  useEffect(() => {
    let active = true;
    if (!session) return;
    void Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]).then(([level, factors]) => {
      if (!active) return;
      setVerified(level.data?.currentLevel === "aal2");
      setFactor(
        factors.data?.totp.find((f) => f.status === "verified")?.id || "",
      );
    });
    return () => {
      active = false;
    };
  }, [session]);
  const source = useResource<unknown>(
    Platform.OS === "web" && admin && verified
      ? `/admin/${section}?offset=${offset}&limit=25`
      : null,
  );
  const pick = (row: DataRow) => {
    setProfessionalVerified(false);
    setRefundReference("");
    setAmount("");
    setRefundKey(randomUUID());
    setSelected(row);
    setReason("");
    setExpiry(text(row.expires_on) || text(row.tnc_valid_until));
    setIssued(text(row.tnc_issued_on));
    setReference(text(row.reference_number) || text(row.tnc_number));
    setPlate(text(row.plate_number));
    setDob("");
    setClasses(
      Array.isArray(row.reviewed_vehicle_classes)
        ? row.reviewed_vehicle_classes.join(",")
        : "",
    );
    setFee(String(number(row.service_fee_bps) / 100));
    setWithDriver(row.chauffeur_enabled === true);
  };
  const save = async (path: string, body: DataRow) => {
    await mutate(path, body);
    source.refresh();
    setSelected(null);
    toast("Change saved.");
  };
  if (Platform.OS !== "web")
    return (
      <View className="flex-1 bg-sand p-10 justify-center">
        <Text className="text-ink">
          Administration is available on the web only.
        </Text>
      </View>
    );
  return (
    <View className="flex-1 bg-sand">
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
          <Badge text="ADMIN WEB" />
        </View>
        {!session ? (
          <Card>
            <Heading
              title="Admin sign-in"
              sub="Use your real account. An active admin role and MFA are required."
            />
            <Button title="Sign in" onPress={() => router.push("/auth")} />
          </Card>
        ) : !admin ? (
          <Card>
            <Heading
              title="Admin access required"
              sub="Your account does not hold an active administrator role. Admin roles are assigned through trusted account administration."
            />
          </Card>
        ) : !verified ? (
          <Card>
            <Heading
              title="Verify multi-factor authentication"
              sub="Use your authenticator app. No demo codes are accepted."
            />
            {!factor && (
              <AsyncButton
                title="Enroll authenticator"
                onPress={async () => {
                  const { data, error } = await supabase.auth.mfa.enroll({
                    factorType: "totp",
                    friendlyName: "CamotesDrive admin",
                  });
                  if (error) throw error;
                  setFactor(data.id);
                  setQr(data.totp.qr_code);
                  setSecret(data.totp.secret);
                }}
              />
            )}
            {qr && (
              <Image
                source={{
                  uri: `data:image/svg+xml;utf8,${encodeURIComponent(qr)}`,
                }}
                style={{ height: 200, width: 200 }}
              />
            )}
            {!!secret && (
              <Text selectable className="text-sm text-ink my-4">
                Manual setup secret: {secret}
              </Text>
            )}
            <Field
              label="Authenticator code"
              value={code}
              onChangeText={setCode}
            />
            <AsyncButton
              title="Verify MFA"
              disabled={!factor || code.length !== 6}
              onPress={async () => {
                const { error } = await supabase.auth.mfa.challengeAndVerify({
                  factorId: factor,
                  code,
                });
                if (error) throw error;
                setVerified(true);
                setSecret("");
                setQr("");
                source.refresh();
              }}
            />
          </Card>
        ) : (
          <>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {[
                "overview",
                "users",
                "roles",
                "documents",
                "vehicles",
                "bookings",
                "payments",
                "payouts",
                "disputes",
                "reviews",
                "settings",
                "audit",
              ].map((s) => (
                <Chip
                  key={s}
                  title={s}
                  selected={section === s}
                  onPress={() => {
                    setSection(s);
                    setOffset(0);
                    setSelected(null);
                  }}
                />
              ))}
            </View>
            <Heading
              title={section[0].toUpperCase() + section.slice(1)}
              sub="Live data. Changes are recorded with your verified identity."
            />
            <ResourceState {...source} retry={source.refresh} />
            {section === "overview" && source.data && (
              <Card>
                {Object.entries(asRow(source.data)).map(([k, v]) => (
                  <DetailRow
                    key={k}
                    title={k.replaceAll("_", " ")}
                    detail={text(v)}
                  />
                ))}
              </Card>
            )}
            {section === "settings" && source.data && (
              <Card>
                <DetailRow
                  title="Service fee"
                  detail={`${number(asRow(source.data).service_fee_bps) / 100}%`}
                />
                <DetailRow
                  title="Chauffeured service"
                  detail={
                    asRow(source.data).chauffeur_enabled
                      ? "Enabled"
                      : "Disabled"
                  }
                />
                <Button
                  title="Edit settings"
                  onPress={() => pick(asRow(source.data))}
                />
              </Card>
            )}
            {rows(source.data).map((row, i) => (
              <Card
                key={
                  text(row.id) || `${text(row.user_id)}-${text(row.role)}-${i}`
                }
              >
                <Badge
                  text={
                    text(row.status) ||
                    text(row.account_status) ||
                    text(row.action) ||
                    section.toUpperCase()
                  }
                />
                <DetailRow
                  title={
                    text(row.name) ||
                    text(row.full_name) ||
                    text(row.title) ||
                    text(row.document_type) ||
                    text(row.role) ||
                    text(row.id) ||
                    text(row.user_id)
                  }
                  detail={text(row.user_id) || text(row.renter_id)}
                  onPress={() => pick(row)}
                />
              </Card>
            ))}
            {Array.isArray(source.data) && (
              <View className="flex-row gap-3 mb-6">
                <Button
                  secondary
                  title="Previous"
                  disabled={!offset}
                  onPress={() => setOffset((n) => Math.max(0, n - 25))}
                />
                <Button
                  secondary
                  title="Next"
                  disabled={source.data.length < 25}
                  onPress={() => setOffset((n) => n + 25)}
                />
              </View>
            )}
            {selected && (
              <Card>
                <Heading title="Review selected record" />
                <Text selectable className="text-xs text-muted leading-5 mb-4">
                  {text(selected.id) || text(selected.user_id)}
                </Text>
                {section === "documents" && (
                  <>
                    <AsyncButton
                      secondary
                      title="View private evidence"
                      onPress={async () =>
                        Linking.openURL(
                          await signedFile(
                            "verification-documents",
                            text(selected.storage_path),
                          ),
                        )
                      }
                    />
                    <Field
                      label="Reference / authority case"
                      value={reference}
                      onChangeText={setReference}
                    />
                    <Field
                      label="Plate from document"
                      value={plate}
                      onChangeText={setPlate}
                    />
                    <Field
                      label="Verified expiry (YYYY-MM-DD)"
                      value={expiry}
                      onChangeText={setExpiry}
                    />
                    <Field
                      label="Verified DOB (government ID review, optional)"
                      value={dob}
                      onChangeText={setDob}
                    />
                    <Field
                      label="Reviewed license vehicle classes (car,suv,van,motorcycle)"
                      value={classes}
                      onChangeText={setClasses}
                    />
                    <Field
                      label="Rejection reason"
                      value={reason}
                      onChangeText={setReason}
                    />
                    <View className="gap-3">
                      {selected.document_type === "professional_license" && (
                        <Chip
                          title={
                            professionalVerified
                              ? "✓ Professional license verified"
                              : "I verified this is a professional license"
                          }
                          selected={professionalVerified}
                          onPress={() =>
                            setProfessionalVerified(!professionalVerified)
                          }
                        />
                      )}
                      <AsyncButton
                        title="Approve reviewed document"
                        disabled={
                          selected.document_type === "professional_license" &&
                          !professionalVerified
                        }
                        onPress={() =>
                          save(`/admin/documents/${text(selected.id)}`, {
                            decision: "approved",
                            reference_number: reference || undefined,
                            plate_number: plate || undefined,
                            expires_on: expiry || undefined,
                            verified_date_of_birth: dob || undefined,
                            license_kind:
                              selected.document_type === "professional_license"
                                ? "professional"
                                : selected.license_kind,
                            vehicle_classes: classes
                              ? classes.split(",").map((s) => s.trim())
                              : undefined,
                          })
                        }
                      />
                      <AsyncButton
                        secondary
                        title="Reject document"
                        disabled={!reason.trim()}
                        onPress={() =>
                          save(`/admin/documents/${text(selected.id)}`, {
                            decision: "rejected",
                            reason,
                          })
                        }
                      />
                    </View>
                  </>
                )}
                {section === "roles" && (
                  <View className="gap-3">
                    <AsyncButton
                      title="Activate verified provider role"
                      onPress={() =>
                        save(`/admin/roles/${text(selected.user_id)}`, {
                          role: selected.role,
                          decision: "active",
                        })
                      }
                    />
                    <Field
                      label="Reason"
                      value={reason}
                      onChangeText={setReason}
                    />
                    <AsyncButton
                      secondary
                      title="Reject request"
                      disabled={!reason.trim()}
                      onPress={() =>
                        save(`/admin/roles/${text(selected.user_id)}`, {
                          role: selected.role,
                          decision: "rejected",
                          reason,
                        })
                      }
                    />
                  </View>
                )}
                {section === "vehicles" && (
                  <View className="gap-3">
                    <Chip
                      title={
                        withDriver
                          ? "✓ Approve with-driver eligibility"
                          : "Self-drive only"
                      }
                      selected={withDriver}
                      onPress={() => setWithDriver(!withDriver)}
                    />
                    <AsyncButton
                      title="Approve eligible listing"
                      onPress={() =>
                        save(`/admin/vehicles/${text(selected.id)}`, {
                          decision: "approved",
                          with_driver: withDriver,
                        })
                      }
                    />
                    <Field
                      label="Reason"
                      value={reason}
                      onChangeText={setReason}
                    />
                    <AsyncButton
                      secondary
                      title="Reject listing"
                      disabled={!reason.trim()}
                      onPress={() =>
                        save(`/admin/vehicles/${text(selected.id)}`, {
                          decision: "rejected",
                          reason,
                        })
                      }
                    />
                  </View>
                )}
                {section === "users" && (
                  <AsyncButton
                    secondary
                    title={
                      selected.account_status === "suspended"
                        ? "Reactivate user"
                        : "Suspend user"
                    }
                    onPress={() =>
                      save(`/admin/users/${text(selected.id)}`, {
                        status:
                          selected.account_status === "suspended"
                            ? "active"
                            : "suspended",
                      })
                    }
                  />
                )}
                {section === "bookings" && (
                  <Button
                    title="Open booking"
                    onPress={() =>
                      router.push({
                        pathname: "/trip/[id]",
                        params: { id: text(selected.id) },
                      })
                    }
                  />
                )}
                {section === "payments" && (
                  <View className="gap-3">
                    {!!selected.proof_path && (
                      <AsyncButton
                        secondary
                        title="View payment proof"
                        onPress={async () =>
                          Linking.openURL(
                            await signedFile(
                              "payment-proofs",
                              text(selected.proof_path),
                            ),
                          )
                        }
                      />
                    )}
                    <DetailRow
                      title="Amount"
                      detail={`${number(selected.amount_centavos) / 100} PHP`}
                    />
                    <DetailRow
                      title="Reference"
                      detail={text(selected.reference_number)}
                    />
                    <AsyncButton
                      title="Confirm verified receipt"
                      disabled={selected.status !== "pending_verification"}
                      onPress={() =>
                        save(`/payments/${text(selected.id)}/confirm`, {})
                      }
                    />
                    <Field
                      label="Refund amount (PHP, already transferred)"
                      value={amount}
                      onChangeText={setAmount}
                    />
                    <Field
                      label="Refund transfer reference"
                      value={refundReference}
                      onChangeText={setRefundReference}
                    />
                    <Field
                      label="Refund reason"
                      value={reason}
                      onChangeText={setReason}
                    />
                    <AsyncButton
                      secondary
                      title="Record completed manual refund"
                      disabled={!amount || !refundReference || !reason}
                      onPress={() =>
                        save("/settlements", {
                          booking_id: selected.booking_id,
                          event_type: "refund",
                          amount_centavos: Math.round(Number(amount) * 100),
                          method: "bank_transfer",
                          reference_number: refundReference,
                          reason,
                          request_id: refundKey,
                        })
                      }
                    />
                  </View>
                )}
                {section === "disputes" && (
                  <View className="gap-3">
                    <Text className="text-sm text-ink">
                      {text(selected.description)}
                    </Text>
                    <AsyncButton
                      title="Assign investigation to me"
                      onPress={() =>
                        save(`/admin/disputes/${text(selected.id)}`, {
                          status: "investigating",
                        })
                      }
                    />
                    {!!selected.booking_id && (
                      <Button
                        secondary
                        title="Open reported booking chat"
                        onPress={() =>
                          router.push({
                            pathname: "/chat/[id]",
                            params: { id: text(selected.booking_id) },
                          })
                        }
                      />
                    )}
                    <Field
                      label="Resolution"
                      value={reason}
                      onChangeText={setReason}
                      multiline
                    />
                    <AsyncButton
                      secondary
                      title="Resolve ticket"
                      disabled={!reason.trim()}
                      onPress={() =>
                        save(`/admin/disputes/${text(selected.id)}`, {
                          status: "resolved",
                          resolution: reason,
                        })
                      }
                    />
                  </View>
                )}
                {section === "reviews" && (
                  <>
                    <Text className="text-sm text-ink mb-4">
                      {text(selected.comment)}
                    </Text>
                    <AsyncButton
                      secondary
                      title={selected.hidden ? "Publish review" : "Hide review"}
                      onPress={() =>
                        save(`/admin/reviews/${text(selected.id)}`, {
                          hidden: !selected.hidden,
                        })
                      }
                    />
                  </>
                )}
                {section === "settings" && (
                  <>
                    <Field
                      label="Service fee (%)"
                      value={fee}
                      onChangeText={setFee}
                    />
                    <Field
                      label="TNC accreditation number"
                      value={reference}
                      onChangeText={setReference}
                    />
                    <Field
                      label="Issue date (YYYY-MM-DD)"
                      value={issued}
                      onChangeText={setIssued}
                    />
                    <Field
                      label="Valid through (YYYY-MM-DD)"
                      value={expiry}
                      onChangeText={setExpiry}
                    />
                    <Chip
                      title={
                        withDriver
                          ? "Enable chauffeured service"
                          : "Chauffeured service disabled"
                      }
                      selected={withDriver}
                      onPress={() => setWithDriver(!withDriver)}
                    />
                    <View className="mt-4">
                      <AsyncButton
                        title="Save platform settings"
                        onPress={() =>
                          save("/admin/settings", {
                            service_fee_bps: Math.round(Number(fee) * 100),
                            chauffeur_enabled: withDriver,
                            tnc_number: reference || undefined,
                            tnc_issued_on: issued || undefined,
                            tnc_valid_until: expiry || undefined,
                            tnc_status: withDriver
                              ? "active"
                              : selected.tnc_status,
                          })
                        }
                      />
                    </View>
                  </>
                )}
              </Card>
            )}
            {section === "payouts" && (
              <Card>
                <Heading
                  title="Record completed manual payout"
                  sub="Transfer funds outside the app, then record the actual reference here."
                />
                <Field
                  label="Provider account UUID"
                  value={provider}
                  onChangeText={setProvider}
                />
                <Field
                  label="Amount paid (PHP)"
                  value={amount}
                  onChangeText={setAmount}
                />
                <Field
                  label="Bank transfer reference"
                  value={reference}
                  onChangeText={setReference}
                />
                <AsyncButton
                  title="Record payout"
                  disabled={!provider || !amount || !reference}
                  onPress={async () => {
                    await save("/admin/payouts", {
                      provider_id: provider,
                      amount_centavos: Math.round(Number(amount) * 100),
                      method: "bank_transfer",
                      reference_number: reference,
                      request_id: payoutKey,
                    });
                    setPayoutKey(randomUUID());
                  }}
                />
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

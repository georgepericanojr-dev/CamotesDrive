import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { randomUUID } from "expo-crypto";
import {
  Brand,
  Button,
  Card,
  Chip,
  Field,
  Heading,
  Row as DetailRow,
} from "@/components/camotes/ui";
import { AsyncButton, ResourceState } from "@/components/camotes/api-ui";
import {
  asRow,
  number,
  rows,
  text,
  titleCase,
  type Row as DataRow,
} from "@/data/models";
import { useApp } from "@/state/app";
import { signedFile } from "@/lib/uploads";
import { useResource } from "@/hooks/use-resource";
import { SignOutButton } from "@/components/camotes/sign-out-button";
import { roleAccountName } from "@/lib/admin-role";
import { useRoleAccounts } from "@/hooks/use-role-accounts";
import { DateField } from "@/components/camotes/date-field";
import { manilaDate } from "@/data/models";
import { isDateOnly } from "@/lib/date-only";
import {
  AdminShell,
  ADMIN_SECTION_LABELS,
  type AdminSection,
} from "@/components/admin/admin-shell";
import { DocumentReview } from "@/components/admin/document-review";
import { AdminIcon } from "@/components/admin/admin-icon";
import { AdminOverview } from "@/components/admin/admin-overview";
import { AdminRecords, AdminSearch } from "@/components/admin/admin-records";
export default function Admin() {
  const {
    session,
    roles,
    initializing,
    identityLoading,
    identityError,
    refresh,
    mutate,
    toast,
  } = useApp();
  const admin = roles.some((r) => r.role === "admin" && r.status === "active");
  const [section, setSection] = useState<AdminSection>("overview");
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [overviewRevision, setOverviewRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const closeButton = useRef<View>(null);
  const [selected, setSelected] = useState<DataRow | null>(null);
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState("");
  const [reference, setReference] = useState("");
  const [withDriver, setWithDriver] = useState(false);
  const [fee, setFee] = useState("");
  const [issued, setIssued] = useState("");
  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState("");
  const [payoutKey, setPayoutKey] = useState(() => randomUUID());
  const [refundKey, setRefundKey] = useState(() => randomUUID());
  const [refundReference, setRefundReference] = useState("");
  const source = useResource<unknown>(
    Platform.OS === "web" && session && admin && !identityError
      ? `/admin/${section}?offset=${offset}&limit=25`
      : null,
    section === "overview" ? 30000 : 0,
  );
  const roleAccounts = useRoleAccounts(
    section === "roles" ? source.data : null,
    Platform.OS === "web" && admin && !identityError && session
      ? `${session.user.id}:${session.expires_at}`
      : null,
  );
  const recordsLoading = source.loading || roleAccounts.loading;
  const recordsError = source.error || roleAccounts.error;
  const pick = (row: DataRow, recordSection: AdminSection = section) => {
    setSelected(row);
    if (recordSection === "payouts" || recordSection === "audit") return;
    setRefundReference("");
    setAmount("");
    setRefundKey(randomUUID());
    setReason("");
    setExpiry(text(row.expires_on) || text(row.tnc_valid_until));
    setIssued(text(row.tnc_issued_on));
    setReference(text(row.reference_number) || text(row.tnc_number));
    setFee(String(number(row.service_fee_bps) / 100));
    setWithDriver(
      row.chauffeur_enabled === true || row.with_driver_eligible === true,
    );
  };
  const navigate = (next: AdminSection) => {
    setSection(next);
    setOffset(0);
    setSelected(null);
    setSearch("");
  };
  const selectRecord = (next: AdminSection, row: DataRow) => {
    navigate(next);
    pick(row, next);
  };
  const refreshDashboard = () => {
    source.refresh();
    setOverviewRevision((revision) => revision + 1);
  };
  const closeRecord = () => {
    if (!savingRef.current) setSelected(null);
  };
  const save = async (path: string, body: DataRow) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await mutate(path, body);
      source.refresh();
      setOverviewRevision((revision) => revision + 1);
      setSelected(null);
      toast("Change saved.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  if (Platform.OS !== "web") {
    return (
      <View className="flex-1 bg-sand p-10 justify-center">
        <Text className="text-ink">
          Administration is available on the web only.
        </Text>
      </View>
    );
  }
  // The dashboard and its data panels mount only after session and role checks.
  if (
    initializing ||
    (session && identityLoading) ||
    !session ||
    identityError ||
    !admin
  ) {
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
          <View className="flex-row flex-wrap justify-between items-center gap-4 mb-8">
            <Brand />
            {!!session && <SignOutButton variant="admin" />}
          </View>
          <Card>
            {initializing || (session && identityLoading) ? (
              <>
                <Heading
                  title="Checking admin access"
                  sub="Loading your account and verified roles."
                />
                <ActivityIndicator color="#164E43" />
              </>
            ) : !session ? (
              <>
                <Heading
                  title="Admin sign-in"
                  sub="Sign in with an account that has an active admin role."
                />
                <Button
                  title="Sign in"
                  onPress={() =>
                    router.push({
                      pathname: "/auth",
                      params: { next: "/admin" },
                    })
                  }
                />
              </>
            ) : identityError ? (
              <>
                <Heading
                  title="Could not check admin access"
                  sub="Your account permissions could not be loaded. Retry the connection after checking the API setup."
                />
                <Text
                  accessibilityRole="alert"
                  className="text-sm text-ink mb-4"
                >
                  {identityError}
                </Text>
                <AsyncButton title="Retry connection" onPress={refresh} />
              </>
            ) : (
              <Heading
                title="Admin access required"
                sub="Your account does not hold an active administrator role. Admin roles are assigned through trusted account administration."
              />
            )}
          </Card>
        </ScrollView>
      </View>
    );
  }

  return (
    <AdminShell
      section={section}
      onSectionChange={navigate}
      search={search}
      onSearchChange={setSearch}
      onSearchSubmit={() => setSearch((query) => query.trim())}
      onNotifications={() => navigate("documents")}
      onRefresh={refreshDashboard}
      refreshing={source.loading}
    >
      {search.trim() ? (
        <AdminSearch
          key={overviewRevision}
          query={search.trim()}
          onSelect={selectRecord}
        />
      ) : (
        <>
          <View className="flex-row flex-wrap items-center justify-between gap-4 mb-8">
            <View className="flex-1 min-w-[240px]">
              <Text
                accessibilityRole="header"
                className="text-4xl font-bold tracking-tight text-ink"
              >
                {ADMIN_SECTION_LABELS[section]}
              </Text>
              <Text className="text-base leading-6 text-muted mt-2">
                Live data. Changes are recorded with your verified identity.
              </Text>
            </View>
            <View className="flex-row items-center gap-2 rounded-full bg-white border border-[#E6EAE2] px-4 py-2.5">
              {recordsLoading ? (
                <ActivityIndicator size="small" color="#164E43" />
              ) : (
                <View
                  className={
                    recordsError
                      ? "h-2 w-2 rounded-full bg-coral"
                      : "h-2 w-2 rounded-full bg-ocean"
                  }
                />
              )}
              <Text
                accessibilityLiveRegion="polite"
                className="text-sm text-ocean"
              >
                {recordsLoading
                  ? "Updating"
                  : recordsError
                    ? "Unavailable"
                    : section === "overview"
                      ? "Live"
                      : "Loaded"}
              </Text>
            </View>
          </View>
          <ResourceState
            loading={recordsLoading}
            error={recordsError}
            retry={refreshDashboard}
          />
          {section === "overview" && source.data !== null && !source.error && (
            <AdminOverview
              key={overviewRevision}
              overview={source.data}
              onNavigate={navigate}
              onSelectUser={(row) => selectRecord("users", row)}
            />
          )}
          {section === "settings" && source.data !== null && !source.error && (
            <Card>
              <Heading
                title="Platform settings"
                sub="Manage service fees and chauffeured rental availability."
              />
              <DetailRow
                title="Service fee"
                detail={
                  String(number(asRow(source.data).service_fee_bps) / 100) + "%"
                }
              />
              <DetailRow
                title="Chauffeured service"
                detail={
                  asRow(source.data).chauffeur_enabled ? "Enabled" : "Disabled"
                }
              />
              <View className="mt-5 self-start">
                <Button
                  title="Edit settings"
                  onPress={() => pick(asRow(source.data))}
                />
              </View>
            </Card>
          )}
          {section !== "overview" &&
            section !== "settings" &&
            !recordsError && (
              <>
                <AdminRecords
                  section={section}
                  data={
                    section === "roles" ? roleAccounts.data : rows(source.data)
                  }
                  loading={recordsLoading}
                  onSelect={pick}
                  selected={selected}
                />
                {Array.isArray(source.data) && (
                  <View className="flex-row flex-wrap items-center justify-between gap-4 mt-5 mb-8">
                    <Text className="text-sm text-muted">
                      Page {Math.floor(offset / 25) + 1}
                      {source.data.length
                        ? " · Showing " +
                          (offset + 1) +
                          "–" +
                          (offset + source.data.length)
                        : " · No records"}
                    </Text>
                    <View className="flex-row gap-3">
                      <Button
                        secondary
                        title="Previous"
                        disabled={!offset || source.loading}
                        onPress={() => {
                          setOffset((value) => Math.max(0, value - 25));
                          setSelected(null);
                        }}
                      />
                      <Button
                        secondary
                        title="Next"
                        disabled={source.data.length < 25 || source.loading}
                        onPress={() => {
                          setOffset((value) => value + 25);
                          setSelected(null);
                        }}
                      />
                    </View>
                  </View>
                )}
              </>
            )}
          <Modal
            visible={!!selected}
            transparent
            animationType="none"
            onRequestClose={closeRecord}
            onShow={() => closeButton.current?.focus()}
          >
            <View
              className="flex-1 flex-row justify-end"
              style={{ backgroundColor: "rgba(27,48,42,0.35)" }}
            >
              <Pressable
                accessibilityLabel="Close record details"
                accessibilityRole="button"
                disabled={saving}
                onPress={closeRecord}
                className="absolute inset-0"
              />
              <View
                accessibilityViewIsModal
                accessibilityLabel="Record details"
                className="w-full max-w-xl bg-sand flex-1 border-l border-[#E6EAE2]"
              >
                <View className="flex-row items-center justify-between gap-4 px-7 py-6 border-b border-[#E6EAE2] bg-white">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold tracking-widest text-muted mb-1">
                      {ADMIN_SECTION_LABELS[section].toUpperCase()}
                    </Text>
                    <Text
                      accessibilityRole="header"
                      className="text-xl font-semibold text-ink"
                    >
                      Review selected record
                    </Text>
                  </View>
                  <Pressable
                    ref={closeButton}
                    accessibilityRole="button"
                    accessibilityLabel="Close record"
                    disabled={saving}
                    onPress={closeRecord}
                    className="p-3 rounded-xl hover:bg-mint focus:bg-mint"
                    style={({ pressed }) => ({
                      opacity: saving ? 0.4 : pressed ? 0.6 : 1,
                    })}
                  >
                    <AdminIcon name="close" />
                  </Pressable>
                </View>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ padding: 28 }}
                >
                  {selected && (
                    <>
                      <Text
                        selectable
                        className="text-xs text-muted leading-5 mb-5"
                      >
                        {section === "roles"
                          ? roleAccountName(selected)
                          : text(selected.id) || text(selected.user_id)}
                      </Text>
                      {[
                        "users",
                        "bookings",
                        "audit",
                        "payouts",
                        "roles",
                      ].includes(section) && (
                        <View className="bg-white rounded-2xl border border-[#E6EAE2] px-5 mb-6">
                          {Object.entries(selected)
                            .filter(
                              ([key]) =>
                                ![
                                  "id",
                                  "user_id",
                                  "avatar_path",
                                  "updated_at",
                                ].includes(key),
                            )
                            .map(([key, value]) => (
                              <DetailRow
                                key={key}
                                title={titleCase(key)}
                                detail={
                                  value == null
                                    ? "—"
                                    : typeof value === "object"
                                      ? JSON.stringify(value)
                                      : text(value)
                                }
                              />
                            ))}
                        </View>
                      )}
                      {section === "documents" && (
                        <DocumentReview
                          key={text(selected.id)}
                          record={selected}
                          onSave={save}
                          saving={saving}
                        />
                      )}
                      {section === "roles" &&
                        !["owner", "driver"].includes(text(selected.role)) && (
                          <Text className="text-sm leading-6 text-muted">
                            Renter and administrator roles are managed through
                            trusted account administration. Provider review is
                            available for Owner and Driver requests.
                          </Text>
                        )}
                      {section === "roles" &&
                        ["owner", "driver"].includes(text(selected.role)) && (
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
                          onPress={() => {
                            setSelected(null);
                            router.push({
                              pathname: "/trip/[id]",
                              params: { id: text(selected.id) },
                            });
                          }}
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
                            disabled={
                              selected.status !== "pending_verification"
                            }
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
                                amount_centavos: Math.round(
                                  Number(amount) * 100,
                                ),
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
                              onPress={() => {
                                setSelected(null);
                                router.push({
                                  pathname: "/chat/[id]",
                                  params: { id: text(selected.booking_id) },
                                });
                              }}
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
                            title={
                              selected.hidden ? "Publish review" : "Hide review"
                            }
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
                          <DateField
                            label="TNC issue date"
                            value={issued}
                            onChangeText={setIssued}
                            maximumDate={
                              isDateOnly(expiry) && expiry < manilaDate()
                                ? expiry
                                : manilaDate()
                            }
                            optional
                          />
                          <DateField
                            label="TNC valid through"
                            value={expiry}
                            onChangeText={setExpiry}
                            minimumDate={
                              isDateOnly(issued) ? issued : undefined
                            }
                            optional
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
                                  service_fee_bps: Math.round(
                                    Number(fee) * 100,
                                  ),
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
                    </>
                  )}
                </ScrollView>
                {saving && (
                  <View className="flex-row items-center justify-center gap-3 py-4 bg-mint">
                    <ActivityIndicator size="small" color="#164E43" />
                    <Text
                      accessibilityLiveRegion="polite"
                      className="text-sm text-ocean"
                    >
                      Saving changes…
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Modal>
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
    </AdminShell>
  );
}

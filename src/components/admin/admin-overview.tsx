import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { asRow, number, rows, text, titleCase, type Row } from "@/data/models";
import { useResource } from "@/hooks/use-resource";
import { AdminIcon } from "./admin-icon";
import type { AdminSection } from "./admin-shell";

type Props = {
  overview: unknown;
  onNavigate: (section: AdminSection) => void;
  onSelectUser?: (user: Row) => void;
};

const date = (value: unknown) => {
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : parsed.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      });
};

function PanelStatus({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  if (loading)
    return (
      <View className="items-center justify-center gap-3 py-9">
        <ActivityIndicator color="#164E43" />
        <Text className="text-sm text-muted">Loading records…</Text>
      </View>
    );
  if (!error) return null;
  return (
    <View className="rounded-2xl bg-sand p-4 gap-3">
      <Text accessibilityRole="alert" className="text-sm text-ink leading-5">
        {error}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        className="self-start py-2"
      >
        <Text className="text-sm font-semibold text-ocean">Try again</Text>
      </Pressable>
    </View>
  );
}

function PanelHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View className="mb-5 flex-row flex-wrap items-center justify-between gap-3">
      <Text
        accessibilityRole="header"
        className="text-xl font-semibold text-ink"
      >
        {title}
      </Text>
      {!!action && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          className="py-2"
        >
          <Text className="text-sm font-semibold text-ocean">{action} →</Text>
        </Pressable>
      )}
    </View>
  );
}

function AttentionRow({
  label,
  detail,
  needsAttention = false,
  neutral = false,
  loading = false,
  onPress,
}: {
  label: string;
  detail: string;
  needsAttention?: boolean;
  neutral?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${detail}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-[#E6EAE2] px-4 py-5"
      style={({ pressed }) => ({
        backgroundColor: pressed ? "#F7F8F4" : "white",
      })}
    >
      <View
        className="h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: neutral
            ? "#77817A"
            : needsAttention
              ? "#C3894B"
              : "#2E9E72",
        }}
      />
      <Text className="flex-1 text-sm text-ink">{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color="#164E43" />
      ) : (
        <Text
          className="text-right text-xs text-muted"
          style={{ maxWidth: "48%" }}
        >
          {detail}
        </Text>
      )}
    </Pressable>
  );
}

export function AdminOverview({ overview, onNavigate, onSelectUser }: Props) {
  const [width, setWidth] = useState(0);
  const users = useResource<unknown>("/admin/users?limit=5&offset=0", 30000);
  const audit = useResource<unknown>("/admin/audit?limit=3&offset=0", 30000);
  const disputes = useResource<unknown>(
    "/admin/disputes?limit=50&offset=0",
    30000,
  );
  const data = asRow(overview);
  const recentUsers = rows(users.data);
  const latestAudit = rows(audit.data);
  const recentDisputes = rows(disputes.data);
  const openDisputes = recentDisputes.filter((row) =>
    ["open", "investigating"].includes(text(row.status)),
  ).length;
  const pending = number(data.pending_documents);
  const columns = width >= 980 ? 4 : width >= 500 ? 2 : 1;
  const sideBySide = width >= 1000;
  const compactTable = width < 650;
  const metrics: {
    label: string;
    key: string;
    caption: string;
    section: AdminSection;
    icon: AdminSection;
    tint: string;
    color: string;
  }[] = [
    {
      label: "Users",
      key: "users",
      caption: "Registered accounts",
      section: "users",
      icon: "users",
      tint: "#EAF2EC",
      color: "#164E43",
    },
    {
      label: "Bookings",
      key: "bookings",
      caption: number(data.bookings)
        ? "Across all statuses"
        : "No bookings yet",
      section: "bookings",
      icon: "bookings",
      tint: "#EAF2EC",
      color: "#164E43",
    },
    {
      label: "Vehicles",
      key: "vehicles",
      caption: number(data.vehicles)
        ? "Approved listings"
        : "No approved listings",
      section: "vehicles",
      icon: "vehicles",
      tint: "#FFF1E2",
      color: "#A36736",
    },
    {
      label: "Pending documents",
      key: "pending_documents",
      caption: pending ? "Waiting for review" : "Nothing to review",
      section: "documents",
      icon: "documents",
      tint: "#EAF2EC",
      color: "#164E43",
    },
  ];

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className="gap-6"
    >
      <View className="flex-row flex-wrap gap-4">
        {metrics.map((metric) => (
          <Pressable
            key={metric.key}
            accessibilityRole="button"
            accessibilityLabel={`${metric.label}: ${number(data[metric.key])}. Open ${metric.label.toLowerCase()}.`}
            onPress={() => onNavigate(metric.section)}
            className="rounded-3xl border border-[#E6EAE2] bg-white p-6"
            style={({ pressed }) => ({
              width: width ? (width - (columns - 1) * 16) / columns : "100%",
              minHeight: 172,
              opacity: pressed ? 0.76 : 1,
            })}
          >
            <View className="mb-4 flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm font-medium text-muted">
                {metric.label}
              </Text>
              <View
                className="h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: metric.tint }}
              >
                <AdminIcon name={metric.icon} color={metric.color} size={20} />
              </View>
            </View>
            <Text className="text-[40px] font-semibold leading-[46px] text-ink">
              {number(data[metric.key]).toLocaleString("en-PH")}
            </Text>
            <Text className="mt-3 text-xs leading-5 text-muted">
              {metric.caption}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className={sideBySide ? "flex-row items-stretch gap-5" : "gap-5"}>
        <View
          className="rounded-3xl border border-[#E6EAE2] bg-white p-6"
          style={sideBySide ? { flex: 0.85 } : undefined}
        >
          <View className="mb-5 flex-row flex-wrap items-center justify-between gap-3">
            <Text
              accessibilityRole="header"
              className="text-xl font-semibold text-ink"
            >
              Needs attention
            </Text>
            <Text className="text-xs text-muted">Review queue</Text>
          </View>
          <View className="gap-4">
            <AttentionRow
              label="Pending documents"
              detail={pending ? `${pending} to review` : "All clear"}
              needsAttention={pending > 0}
              onPress={() => onNavigate("documents")}
            />
            <AttentionRow
              label="Open disputes"
              loading={disputes.loading}
              detail={
                disputes.error
                  ? "Unavailable"
                  : recentDisputes.length === 50
                    ? `${openDisputes} in latest 50`
                    : openDisputes
                      ? String(openDisputes)
                      : "All clear"
              }
              needsAttention={openDisputes > 0 || !!disputes.error}
              onPress={() => onNavigate("disputes")}
            />
            <AttentionRow
              label="Manual payouts"
              detail="View records"
              neutral
              onPress={() => onNavigate("payouts")}
            />
          </View>
          {!!disputes.error && (
            <View className="mt-4">
              <PanelStatus
                loading={false}
                error={disputes.error}
                retry={disputes.refresh}
              />
            </View>
          )}
          <Text className="mt-5 text-xs leading-5 text-muted">
            {recentDisputes.length === 50
              ? "Disputes show open items among the latest 50 records. "
              : ""}
            Record manual payouts after transferring funds outside the app.
          </Text>
        </View>

        <View
          className="rounded-3xl border border-[#E6EAE2] bg-white p-6"
          style={sideBySide ? { flex: 1.15, minWidth: 0 } : undefined}
        >
          <PanelHeading
            title="Recent users"
            action="View all"
            onPress={() => onNavigate("users")}
          />
          <PanelStatus
            loading={users.loading}
            error={users.error}
            retry={users.refresh}
          />
          {!users.loading &&
            !users.error &&
            (recentUsers.length ? (
              <View>
                {!compactTable && (
                  <View className="flex-row gap-3 border-b border-[#E6EAE2] pb-3">
                    <Text className="flex-1 text-[10px] font-semibold tracking-wider text-muted">
                      USER
                    </Text>
                    <Text className="w-20 text-[10px] font-semibold tracking-wider text-muted">
                      MODE
                    </Text>
                    <Text className="w-[88px] text-[10px] font-semibold tracking-wider text-muted">
                      STATUS
                    </Text>
                    <Text className="w-24 text-[10px] font-semibold tracking-wider text-muted">
                      JOINED
                    </Text>
                  </View>
                )}
                {recentUsers.map((user) => {
                  const name = text(user.full_name).trim() || "Unnamed account";
                  const initials =
                    text(user.full_name)
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase() || "?";
                  return (
                    <Pressable
                      key={text(user.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Manage ${name}`}
                      onPress={() =>
                        onSelectUser ? onSelectUser(user) : onNavigate("users")
                      }
                      className="flex-row flex-wrap items-center gap-3 border-b border-[#EEF0E9] py-4"
                      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                    >
                      <View
                        className="flex-row items-center gap-3"
                        style={{
                          flex: compactTable ? undefined : 1,
                          minWidth: 0,
                          width: compactTable ? "100%" : undefined,
                        }}
                      >
                        <View className="h-10 w-10 items-center justify-center rounded-full bg-mint">
                          <Text className="text-sm font-semibold text-ocean">
                            {initials}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text
                            numberOfLines={1}
                            className="text-sm font-semibold text-ink"
                          >
                            {name}
                          </Text>
                          <Text className="mt-1 text-xs text-muted">
                            ID {text(user.id).slice(0, 8)}
                          </Text>
                        </View>
                      </View>
                      <Text className="w-20 text-xs text-ink">
                        {titleCase(user.preferred_mode) || "Unavailable"}
                      </Text>
                      <View
                        className={`w-[88px] items-start ${compactTable ? "flex-1" : ""}`}
                      >
                        <View
                          className={`rounded-full px-2.5 py-1.5 ${user.account_status === "active" ? "bg-mint" : "bg-[#FFF1E2]"}`}
                        >
                          <Text
                            className={`text-[11px] font-medium ${user.account_status === "active" ? "text-ocean" : "text-[#A36736]"}`}
                          >
                            {titleCase(user.account_status)}
                          </Text>
                        </View>
                      </View>
                      <Text className="w-24 text-xs text-muted">
                        {date(user.created_at)}
                      </Text>
                    </Pressable>
                  );
                })}
                <Text className="mt-4 text-[11px] leading-5 text-muted">
                  Mode is the account’s preferred mode. Manage verified
                  permissions in Roles.
                </Text>
              </View>
            ) : (
              <Text className="py-8 text-sm text-muted">
                No registered users to display.
              </Text>
            ))}
        </View>
      </View>

      <View className="rounded-3xl border border-[#E6EAE2] bg-white p-6">
        <PanelHeading
          title="Latest audit entries"
          action="Open audit log"
          onPress={() => onNavigate("audit")}
        />
        <Text className="mb-4 text-sm leading-5 text-muted">
          Changes are recorded with the identity that performed them.
        </Text>
        <PanelStatus
          loading={audit.loading}
          error={audit.error}
          retry={audit.refresh}
        />
        {!audit.loading &&
          !audit.error &&
          (latestAudit.length ? (
            <View>
              {latestAudit.map((entry) => (
                <View
                  key={text(entry.id)}
                  className="flex-row flex-wrap items-center justify-between gap-3 border-t border-[#EEF0E9] py-4"
                >
                  <View className="flex-1" style={{ minWidth: 160 }}>
                    <Text className="text-sm font-medium text-ink">
                      {titleCase(entry.action)} · {titleCase(entry.table_name)}
                    </Text>
                    <Text className="mt-1 text-xs text-muted">
                      {entry.actor_id
                        ? `Account ${text(entry.actor_id).slice(0, 8)}`
                        : titleCase(entry.database_role) || "System"}
                      {entry.record_id
                        ? ` · Record ${text(entry.record_id).slice(0, 8)}`
                        : ""}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted">
                    {date(entry.created_at)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-sm text-muted">
              No audit entries yet. Recorded changes will appear here.
            </Text>
          ))}
      </View>
    </View>
  );
}

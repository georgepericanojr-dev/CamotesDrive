import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  asRow,
  php,
  rows,
  text,
  titleCase,
  type Row as DataRow,
} from "@/data/models";
import { useResource } from "@/hooks/use-resource";
import { roleAccountName } from "@/lib/admin-role";
import { AdminIcon, type AdminIconName } from "./admin-icon";
import { ADMIN_SECTION_LABELS, type AdminSection } from "./admin-shell";

type Column = {
  label: string;
  flex?: number;
  render: (row: DataRow) => ReactNode;
};

function shortId(value: unknown) {
  const id = text(value);
  return id ? id.slice(0, 8) : "—";
}

function date(value: unknown) {
  const valueText = text(value);
  if (!valueText) return "—";
  const parsed = new Date(
    valueText.length === 10 ? `${valueText}T12:00:00+08:00` : valueText,
  );
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      });
}

function Cell({ value, secondary }: { value: unknown; secondary?: unknown }) {
  return (
    <View className="min-w-0">
      <Text numberOfLines={2} className="text-[13px] leading-5 text-ink">
        {text(value) || "—"}
      </Text>
      {!!secondary && (
        <Text
          numberOfLines={1}
          className="mt-1 text-[11px] leading-4 text-muted"
        >
          {text(secondary)}
        </Text>
      )}
    </View>
  );
}

export function AdminStatus({ value }: { value: unknown }) {
  const status = text(value);
  const positive = [
    "active",
    "approved",
    "confirmed",
    "completed",
    "recorded",
    "paid",
    "resolved",
    "published",
  ].includes(status);
  const waiting =
    status.startsWith("pending") ||
    ["open", "investigating", "unpaid", "disputed"].includes(status);
  return (
    <View
      className={`self-start rounded-full px-2.5 py-1.5 ${positive ? "bg-mint" : waiting ? "bg-[#FFF1E2]" : "bg-[#F0F1EC]"}`}
    >
      <Text
        className={`text-[11px] font-semibold ${positive ? "text-ocean" : waiting ? "text-[#986038]" : "text-muted"}`}
      >
        {titleCase(status) || "Unknown"}
      </Text>
    </View>
  );
}

function PrimaryCell({
  title,
  subtitle,
  icon,
  initials,
}: {
  title: string;
  subtitle?: string;
  icon?: AdminIconName;
  initials?: boolean;
}) {
  const letters =
    title
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <View className="min-w-0 flex-row items-center gap-3">
      {(icon || initials) && (
        <View
          className={`h-10 w-10 shrink-0 items-center justify-center bg-mint ${initials ? "rounded-full" : "rounded-xl"}`}
        >
          {initials ? (
            <Text className="text-sm font-semibold text-ocean">{letters}</Text>
          ) : (
            <AdminIcon name={icon!} size={18} />
          )}
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className="text-[13px] font-semibold leading-5 text-ink"
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            numberOfLines={1}
            className="mt-0.5 text-[11px] leading-4 text-muted"
          >
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

function recordTitle(section: AdminSection, row: DataRow) {
  switch (section) {
    case "users":
      return text(row.full_name) || "Unnamed user";
    case "roles":
      return roleAccountName(row);
    case "documents":
      return titleCase(row.document_type) || "Document";
    case "vehicles":
      return text(row.name) || "Untitled vehicle";
    case "bookings":
      return row.booking_number != null
        ? `Booking #${text(row.booking_number)}`
        : `Booking ${shortId(row.id)}`;
    case "payments":
      return titleCase(row.event_type) || "Payment";
    case "payouts":
      return `Payout ${shortId(row.id)}`;
    case "disputes":
      return titleCase(row.category) || "Dispute";
    case "reviews":
      return `${text(row.rating) || "—"} / 5 rating`;
    case "audit":
      return titleCase(row.action) || "Audit entry";
    default:
      return text(row.name) || text(row.id) || "Record";
  }
}

function columnsFor(section: AdminSection): Column[] {
  const joined: Column = {
    label: "Joined",
    render: (row) => <Cell value={date(row.created_at)} />,
  };
  const created: Column = { ...joined, label: "Created" };
  const status: Column = {
    label: "Status",
    render: (row) => <AdminStatus value={row.status || row.account_status} />,
  };
  switch (section) {
    case "users":
      return [
        {
          label: "User",
          flex: 2.3,
          render: (row) => (
            <PrimaryCell
              initials
              title={recordTitle(section, row)}
              subtitle={text(row.phone) || `ID ${shortId(row.id)}`}
            />
          ),
        },
        {
          label: "Preferred mode",
          render: (row) => <Cell value={titleCase(row.preferred_mode)} />,
        },
        status,
        joined,
      ];
    case "roles":
      return [
        {
          label: "Account / role",
          flex: 1.8,
          render: (row) => (
            <PrimaryCell
              initials
              title={recordTitle(section, row)}
              subtitle={`${titleCase(row.role) || "Account"} role`}
            />
          ),
        },
        status,
        { ...created, label: "Requested" },
        {
          label: "Verified",
          render: (row) => <Cell value={date(row.verified_at)} />,
        },
      ];
    case "documents":
      return [
        {
          label: "Document",
          flex: 2.1,
          render: (row) => (
            <PrimaryCell
              icon="documents"
              title={recordTitle(section, row)}
              subtitle={text(row.reference_number) || `ID ${shortId(row.id)}`}
            />
          ),
        },
        {
          label: "Account",
          render: (row) => <Cell value={shortId(row.user_id)} />,
        },
        status,
        {
          label: "Expires",
          render: (row) => <Cell value={date(row.expires_on)} />,
        },
      ];
    case "vehicles":
      return [
        {
          label: "Vehicle",
          flex: 2,
          render: (row) => (
            <PrimaryCell
              icon="vehicles"
              title={recordTitle(section, row)}
              subtitle={[row.plate_number, titleCase(row.vehicle_type)]
                .filter(Boolean)
                .join(" · ")}
            />
          ),
        },
        {
          label: "Pickup town",
          render: (row) => <Cell value={row.pickup_town} />,
        },
        {
          label: "Daily rate",
          render: (row) => <Cell value={php(row.daily_rate_centavos)} />,
        },
        status,
      ];
    case "bookings":
      return [
        {
          label: "Booking",
          flex: 1.7,
          render: (row) => (
            <PrimaryCell
              icon="bookings"
              title={recordTitle(section, row)}
              subtitle={
                text(asRow(row.vehicle).name) || shortId(row.vehicle_id)
              }
            />
          ),
        },
        {
          label: "Rental dates",
          flex: 1.3,
          render: (row) => (
            <Cell
              value={date(row.starts_at)}
              secondary={`to ${date(row.ends_at)}`}
            />
          ),
        },
        {
          label: "Total",
          render: (row) => <Cell value={php(row.total_centavos)} />,
        },
        status,
        {
          label: "Payment",
          render: (row) => <AdminStatus value={row.payment_status} />,
        },
      ];
    case "payments":
      return [
        {
          label: "Payment",
          flex: 1.7,
          render: (row) => (
            <PrimaryCell
              icon="payments"
              title={recordTitle(section, row)}
              subtitle={
                text(row.reference_number) ||
                `Booking ${shortId(row.booking_id)}`
              }
            />
          ),
        },
        {
          label: "Amount",
          render: (row) => <Cell value={php(row.amount_centavos)} />,
        },
        {
          label: "Method",
          render: (row) => <Cell value={titleCase(row.method)} />,
        },
        status,
        created,
      ];
    case "payouts":
      return [
        {
          label: "Payout",
          flex: 1.7,
          render: (row) => (
            <PrimaryCell
              icon="payouts"
              title={recordTitle(section, row)}
              subtitle={`Provider ${shortId(row.provider_id)}`}
            />
          ),
        },
        {
          label: "Amount",
          render: (row) => <Cell value={php(row.amount_centavos)} />,
        },
        {
          label: "Reference",
          render: (row) => (
            <Cell
              value={row.reference_number}
              secondary={titleCase(row.method)}
            />
          ),
        },
        status,
        {
          ...created,
          label: "Recorded",
          render: (row) => <Cell value={date(row.paid_at || row.created_at)} />,
        },
      ];
    case "disputes":
      return [
        {
          label: "Dispute",
          flex: 2.1,
          render: (row) => (
            <PrimaryCell
              icon="disputes"
              title={recordTitle(section, row)}
              subtitle={text(row.description)}
            />
          ),
        },
        {
          label: "Booking",
          render: (row) => <Cell value={shortId(row.booking_id)} />,
        },
        status,
        { ...created, label: "Reported" },
      ];
    case "reviews":
      return [
        {
          label: "Review",
          flex: 2.2,
          render: (row) => (
            <PrimaryCell
              icon="reviews"
              title={recordTitle(section, row)}
              subtitle={text(row.comment) || "No comment provided"}
            />
          ),
        },
        {
          label: "Target",
          render: (row) => (
            <Cell
              value={titleCase(row.target_type)}
              secondary={shortId(row.vehicle_id || row.driver_id)}
            />
          ),
        },
        {
          label: "Visibility",
          render: (row) => (
            <AdminStatus value={row.hidden ? "hidden" : "published"} />
          ),
        },
        created,
      ];
    case "audit":
      return [
        {
          label: "Action",
          flex: 1.6,
          render: (row) => (
            <PrimaryCell
              icon="audit"
              title={recordTitle(section, row)}
              subtitle={text(row.table_name)}
            />
          ),
        },
        {
          label: "Actor",
          render: (row) => (
            <Cell value={shortId(row.actor_id)} secondary={row.database_role} />
          ),
        },
        {
          label: "Changed fields",
          flex: 1.5,
          render: (row) => (
            <Cell
              value={
                Array.isArray(row.changed_fields)
                  ? row.changed_fields.join(", ")
                  : "—"
              }
            />
          ),
        },
        { ...created, label: "Date" },
      ];
    default:
      return [
        {
          label: "Record",
          flex: 2,
          render: (row) => <Cell value={recordTitle(section, row)} />,
        },
        status,
        created,
      ];
  }
}

function searchText(section: AdminSection, row: DataRow) {
  const fields: Record<string, string[]> = {
    users: ["id", "full_name", "phone", "preferred_mode", "account_status"],
    bookings: [
      "id",
      "booking_number",
      "renter_id",
      "owner_id",
      "driver_id",
      "vehicle_id",
      "status",
      "payment_status",
      "service_type",
      "pickup_town",
      "pickup_name",
    ],
    vehicles: [
      "id",
      "name",
      "make",
      "model",
      "plate_number",
      "pickup_town",
      "vehicle_type",
      "status",
      "owner_id",
    ],
  };
  const values = (fields[section] || Object.keys(row)).map((key) => {
    const value = row[key];
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";
  });
  if (section === "bookings") values.push(text(asRow(row.vehicle).name));
  return values.join(" ").toLocaleLowerCase();
}

function matches(section: AdminSection, row: DataRow, query: string) {
  const haystack = searchText(section, row);
  return query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

function rowKey(section: AdminSection, row: DataRow, index = 0) {
  return (
    text(row.id) ||
    `${section}:${text(row.user_id)}:${text(row.role)}:${text(row.created_at)}:${index}`
  );
}

export function AdminRecords({
  section,
  data,
  loading,
  search = "",
  onSelect,
  selected,
}: {
  section: AdminSection;
  data: DataRow[];
  loading: boolean;
  search?: string;
  onSelect: (row: DataRow) => void;
  selected?: DataRow | null;
}) {
  const visibleRows = search.trim()
    ? data.filter((row) => matches(section, row, search))
    : data;
  const columns = columnsFor(section);
  const viewOnly = section === "audit" || section === "payouts";
  return (
    <View className="overflow-hidden rounded-3xl border border-[#E3E8E0] bg-white">
      <View className="flex-row items-center justify-between gap-4 px-6 py-5">
        <Text className="text-[18px] font-semibold text-ink">
          {ADMIN_SECTION_LABELS[section]} records
        </Text>
        <Text className="text-xs text-muted">
          {visibleRows.length}{" "}
          {search.trim() ? "matches on this page" : "on this page"}
        </Text>
      </View>
      {loading && data.length === 0 ? (
        <View
          className="items-center gap-3 px-6 py-16"
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator color="#164E43" />
          <Text className="text-sm text-muted">Loading records…</Text>
        </View>
      ) : visibleRows.length === 0 ? (
        <View className="items-center gap-3 border-t border-[#EEF0E9] px-8 py-16">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-mint">
            <AdminIcon name={search.trim() ? "search" : section} size={23} />
          </View>
          <Text className="text-base font-semibold text-ink">
            {search.trim()
              ? "No matching records"
              : `No ${section} records yet`}
          </Text>
          <Text className="max-w-sm text-center text-sm leading-6 text-muted">
            {search.trim()
              ? "Try another name, reference, or account ID in this page."
              : "New records will appear here when they are available."}
          </Text>
        </View>
      ) : (
        <ScrollView horizontal contentContainerStyle={{ minWidth: "100%" }}>
          <View
            style={{ flex: 1, minWidth: section === "bookings" ? 930 : 790 }}
          >
            <View className="flex-row items-center border-y border-[#EEF0E9] bg-sand/60 px-6 py-3.5">
              {columns.map((column) => (
                <View
                  key={column.label}
                  style={{ flex: column.flex || 1 }}
                  className="pr-4"
                >
                  <Text className="text-[10px] font-bold uppercase tracking-[1px] text-muted">
                    {column.label}
                  </Text>
                </View>
              ))}
              <View className="w-[70px]">
                <Text className="text-right text-[10px] font-bold uppercase tracking-[1px] text-muted">
                  Action
                </Text>
              </View>
            </View>
            {visibleRows.map((row, index) => {
              const active =
                !!selected &&
                (selected === row ||
                  rowKey(section, selected) === rowKey(section, row));
              return (
                <Pressable
                  key={rowKey(section, row, index)}
                  accessibilityRole="button"
                  accessibilityLabel={`${viewOnly ? "View" : "Review"} ${recordTitle(section, row)}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => onSelect(row)}
                  className={`min-h-[86px] flex-row items-center border-b border-[#EEF0E9] px-6 py-5 hover:bg-sand focus:bg-mint ${active ? "bg-mint" : "bg-white"}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  {columns.map((column) => (
                    <View
                      key={column.label}
                      style={{ flex: column.flex || 1 }}
                      className="min-w-0 pr-4"
                    >
                      {column.render(row)}
                    </View>
                  ))}
                  <View className="w-[70px] flex-row items-center justify-end gap-1">
                    <Text className="text-[12px] font-semibold text-ocean">
                      {viewOnly ? "View" : "Review"}
                    </Text>
                    <AdminIcon name="chevron" size={13} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function SearchCategory({
  section,
  query,
  onSelect,
}: {
  section: "users" | "bookings" | "vehicles";
  query: string;
  onSelect: (section: AdminSection, row: DataRow) => void;
}) {
  // The API caps a page at 50. Two pages search the latest 100 without changing
  // the server contract or claiming to search every record in the database.
  const first = useResource<unknown>(`/admin/${section}?limit=50&offset=0`);
  const second = useResource<unknown>(`/admin/${section}?limit=50&offset=50`);
  const data = [...rows(first.data), ...rows(second.data)];
  const found = data.filter((row) => matches(section, row, query));
  const loading = first.loading || second.loading;
  const error = first.error || second.error;
  return (
    <View className="overflow-hidden rounded-2xl border border-[#E3E8E0] bg-white">
      <View className="flex-row flex-wrap items-center justify-between gap-3 border-b border-[#EEF0E9] px-5 py-4">
        <View className="flex-row items-center gap-2.5">
          <AdminIcon name={section} size={19} />
          <Text className="text-[15px] font-semibold text-ink">
            {ADMIN_SECTION_LABELS[section]}
          </Text>
        </View>
        <Text className="text-xs text-muted">
          {found.length} matches in {data.length} loaded records
        </Text>
      </View>
      {loading && (
        <View
          className="flex-row items-center gap-3 px-5 py-4"
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator size="small" color="#164E43" />
          <Text className="text-xs text-muted">Searching the latest 100…</Text>
        </View>
      )}
      {!!error && (
        <View className="m-4 rounded-xl bg-[#FFF1E2] p-4">
          <Text
            accessibilityRole="alert"
            className="text-xs leading-5 text-ink"
          >
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Retry ${section} search`}
            onPress={() => {
              first.refresh();
              second.refresh();
            }}
            className="mt-2 self-start rounded-lg py-2 pr-3 focus:bg-mint"
          >
            <Text className="text-xs font-semibold text-ocean">
              Retry search
            </Text>
          </Pressable>
        </View>
      )}
      {found.slice(0, 10).map((row, index) => (
        <Pressable
          key={rowKey(section, row, index)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${recordTitle(section, row)}`}
          onPress={() => onSelect(section, row)}
          className="flex-row items-center justify-between gap-4 border-b border-[#EEF0E9] px-5 py-4 hover:bg-sand focus:bg-mint"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <View className="min-w-0 flex-1">
            <PrimaryCell
              title={recordTitle(section, row)}
              subtitle={
                section === "users"
                  ? text(row.phone) || `ID ${shortId(row.id)}`
                  : section === "bookings"
                    ? text(asRow(row.vehicle).name) || `ID ${shortId(row.id)}`
                    : text(row.plate_number) || text(row.pickup_town)
              }
              initials={section === "users"}
              icon={section === "users" ? undefined : section}
            />
          </View>
          <AdminStatus value={row.status || row.account_status} />
          <AdminIcon name="chevron" size={16} />
        </Pressable>
      ))}
      {!loading && !error && found.length === 0 && (
        <Text className="px-5 py-7 text-sm text-muted">
          No matching {section} in the loaded records.
        </Text>
      )}
      {found.length > 10 && (
        <Text className="px-5 py-4 text-xs text-muted">
          Showing the first 10 matches. Add another search term to narrow the
          results.
        </Text>
      )}
    </View>
  );
}

export function AdminSearch({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (section: AdminSection, row: DataRow) => void;
}) {
  const ready = query.trim().length >= 2;
  return (
    <View className="gap-5">
      <View className="rounded-2xl border border-[#E3E8E0] bg-white px-5 py-4">
        <Text className="text-base font-semibold text-ink">Search records</Text>
        <Text className="mt-1 text-sm leading-6 text-muted">
          {ready
            ? "Searches the latest 100 users, 100 bookings, and 100 vehicles by name, status, reference, or ID."
            : "Enter at least two characters to search the latest 100 records in each category."}
        </Text>
      </View>
      {ready &&
        (["users", "bookings", "vehicles"] as const).map((section) => (
          <SearchCategory
            key={section}
            section={section}
            query={query}
            onSelect={onSelect}
          />
        ))}
    </View>
  );
}

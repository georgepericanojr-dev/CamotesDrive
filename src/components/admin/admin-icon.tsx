import { AppIcon, type AppIconName } from "@/components/camotes/app-icon";

const names = {
  overview: "home",
  users: "users",
  roles: "shield",
  documents: "file-text",
  vehicles: "car",
  bookings: "calendar",
  reviews: "star",
  payments: "receipt",
  payouts: "payout",
  disputes: "triangle-alert",
  settings: "settings",
  audit: "clipboard-list",
  search: "search",
  bell: "bell",
  menu: "menu",
  close: "x",
  refresh: "refresh",
  arrow: "arrow-right",
  chevron: "chevron-right",
} as const satisfies Record<string, AppIconName>;
export type AdminIconName = keyof typeof names;

export function AdminIcon({
  name,
  size = 21,
  color = "#164E43",
}: {
  name: AdminIconName;
  size?: number;
  color?: string;
}) {
  return <AppIcon name={names[name]} size={size} color={color} />;
}

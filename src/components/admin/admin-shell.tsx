import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SignOutButton } from "@/components/camotes/sign-out-button";
import { AdminIcon, type AdminIconName } from "./admin-icon";
import { AppLogo } from "@/components/camotes/app-icon";
import { MotionView } from "@/components/camotes/motion";

export type AdminSection =
  | "overview"
  | "users"
  | "roles"
  | "documents"
  | "vehicles"
  | "bookings"
  | "reviews"
  | "payments"
  | "payouts"
  | "disputes"
  | "settings"
  | "audit";

export const ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  overview: "Overview",
  users: "Users",
  roles: "Roles",
  documents: "Documents",
  vehicles: "Vehicles",
  bookings: "Bookings",
  reviews: "Reviews",
  payments: "Payments",
  payouts: "Payouts",
  disputes: "Disputes",
  settings: "Settings",
  audit: "Audit",
};

const navigationGroups: { title: string; sections: AdminSection[] }[] = [
  { title: "Dashboard", sections: ["overview"] },
  { title: "People", sections: ["users", "roles", "documents"] },
  { title: "Marketplace", sections: ["vehicles", "bookings", "reviews"] },
  { title: "Money", sections: ["payments", "payouts", "disputes"] },
  { title: "System", sections: ["settings", "audit"] },
];

function AdminBrand({ compact = false }: { compact?: boolean }) {
  return <AppLogo white compact={compact} width={214} />;
}

function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  busy = false,
}: {
  icon: AdminIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      className="h-12 w-12 items-center justify-center rounded-2xl border border-[#E0E6DE] bg-white hover:bg-mint focus:border-ocean"
      style={({ pressed }) => ({
        opacity: disabled ? 0.5 : pressed ? 0.65 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color="#164E43" size="small" />
      ) : (
        <AdminIcon name={icon} />
      )}
    </Pressable>
  );
}

export function AdminShell({
  section,
  onSectionChange,
  search,
  onSearchChange,
  onSearchSubmit,
  onNotifications,
  children,
  refreshing = false,
  onRefresh,
}: {
  section: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  search: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  onNotifications: () => void;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { width } = useWindowDimensions();
  const desktop = width >= 1050;
  const narrow = width < 800;
  const tiny = width < 400;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTrigger = useRef<View>(null);
  const closeButton = useRef<View>(null);

  const closeMenu = () => {
    setMenuOpen(false);
    menuTrigger.current?.focus();
  };

  const navigation = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: 24, paddingBottom: 28 }}
    >
      {navigationGroups.map((group) => (
        <View key={group.title} className="mb-6">
          <Text className="mb-2 px-4 text-[11px] font-bold uppercase tracking-[1.4px] text-[#A8C6BA]">
            {group.title}
          </Text>
          {group.sections.map((item) => {
            const active = item === section;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={ADMIN_SECTION_LABELS[item]}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onSectionChange(item);
                  if (!desktop) closeMenu();
                }}
                className={`mb-1 min-h-11 flex-row items-center gap-3 rounded-xl px-4 py-3 focus:border focus:border-coral ${active ? "bg-sand" : "hover:bg-white/10"}`}
                style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
              >
                <AdminIcon
                  name={item}
                  size={20}
                  color={active ? "#164E43" : "#D1E2D8"}
                />
                <Text
                  className={`text-[15px] font-semibold ${active ? "text-ocean" : "text-[#D1E2D8]"}`}
                >
                  {ADMIN_SECTION_LABELS[item]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );

  const searchField = (
    <View className="min-h-12 min-w-0 flex-1 flex-row items-center gap-3 rounded-2xl border border-[#E0E6DE] bg-white px-4 focus-within:border-ocean">
      <AdminIcon name="search" color="#77817A" size={20} />
      <TextInput
        accessibilityLabel="Search the latest 100 records in each admin category"
        placeholder="Search users, bookings, vehicles..."
        placeholderTextColor="#77817A"
        value={search}
        onChangeText={onSearchChange}
        onSubmitEditing={onSearchSubmit}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        className="min-w-0 flex-1 py-3 text-[14px] text-ink outline-none"
      />
      {search.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onSearchChange("")}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-lg hover:bg-mint focus:bg-mint"
        >
          <AdminIcon name="close" color="#77817A" size={16} />
        </Pressable>
      )}
    </View>
  );

  return (
    <View className="flex-1 flex-row bg-sand">
      {desktop && (
        <View
          accessibilityLabel="Admin navigation"
          className="w-[270px] bg-ocean px-[18px] pt-8"
        >
          <View className="px-2 pb-2">
            <AdminBrand />
          </View>
          {navigation}
        </View>
      )}
      <View className="min-w-0 flex-1">
        <View
          className="gap-3"
          style={{
            paddingHorizontal: desktop ? 40 : narrow ? 18 : 28,
            paddingTop: desktop ? 30 : 20,
            paddingBottom: desktop ? 28 : 20,
          }}
        >
          <View className="flex-row items-center gap-3">
            {!desktop && (
              <Pressable
                ref={menuTrigger}
                accessibilityRole="button"
                accessibilityLabel="Open admin navigation"
                accessibilityState={{ expanded: menuOpen }}
                onPress={() => setMenuOpen(true)}
                className="h-12 w-12 items-center justify-center rounded-2xl border border-[#E0E6DE] bg-white hover:bg-mint focus:border-ocean"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
              >
                <AdminIcon name="menu" />
              </Pressable>
            )}
            {!narrow && searchField}
            {narrow && <View className="flex-1" />}
            {!tiny && (
              <View className="rounded-full bg-[#E0EDE5] px-3 py-2">
                <Text className="text-[10px] font-bold tracking-wide text-ocean">
                  ADMIN WEB
                </Text>
              </View>
            )}
            {onRefresh && !narrow && (
              <IconButton
                icon="refresh"
                label="Refresh admin data"
                onPress={onRefresh}
                busy={refreshing}
                disabled={refreshing}
              />
            )}
            <IconButton
              icon="bell"
              label="Review pending documents"
              onPress={onNotifications}
            />
            <SignOutButton variant="admin" />
          </View>
          {narrow && (
            <View className="flex-row items-center gap-3">
              {searchField}
              {onRefresh && (
                <IconButton
                  icon="refresh"
                  label="Refresh admin data"
                  onPress={onRefresh}
                  busy={refreshing}
                  disabled={refreshing}
                />
              )}
            </View>
          )}
        </View>
        <ScrollView
          key={section}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: desktop ? 40 : narrow ? 18 : 28,
            paddingBottom: 36,
            maxWidth: 1800,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <MotionView transitionKey={section}>{children}</MotionView>
        </ScrollView>
      </View>
      <Modal
        visible={!desktop && menuOpen}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
        onShow={() => closeButton.current?.focus()}
      >
        <View className="flex-1 flex-row bg-black/30">
          <View
            accessibilityViewIsModal
            accessibilityLabel="Admin navigation"
            className="w-[300px] max-w-[88%] bg-ocean px-[18px] pt-6"
          >
            <View className="flex-row items-center justify-between px-2 pb-1">
              <AdminBrand compact={tiny} />
              <Pressable
                ref={closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close admin navigation"
                onPress={closeMenu}
                className="h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10 focus:bg-white/10"
              >
                <AdminIcon name="close" color="#F7F8F4" />
              </Pressable>
            </View>
            {navigation}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close admin navigation"
            onPress={closeMenu}
            className="flex-1"
          />
        </View>
      </Modal>
    </View>
  );
}

import React from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Image,
  Platform,
  useWindowDimensions,
} from "react-native";
import { router, usePathname, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/state/app";
import { money, type Vehicle } from "@/data/models";
import { renterHomeHref } from "@/lib/navigation";
import type { RentalDates } from "@/lib/rental-dates";
import { AppIcon, AppLogo, type AppIconName } from "./app-icon";
import { MotionView } from "./motion";
export function Icon({
  name,
  size = 21,
  color = "#164E43",
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const symbols: Record<string, AppIconName> = {
    explore: "compass",
    trips: "calendar",
    messages: "message-circle",
    profile: "user",
    heart: "heart",
    arrow: "arrow-up-right",
    pin: "map-pin",
    calendar: "calendar",
    search: "search",
    filter: "sliders",
    bell: "bell",
    check: "check",
    car: "car",
    star: "star-filled",
    dashboard: "layout-dashboard",
    earnings: "wallet",
    vehicles: "car",
  };
  return (
    <AppIcon name={symbols[name] || "compass"} size={size} color={color} />
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`rounded-2xl px-5 py-4 items-center justify-center ${disabled ? "bg-gray-200" : secondary ? "bg-mint border border-[#D9E5DC]" : "bg-ocean"}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <Text
        className={`font-semibold text-[14px] ${secondary ? "text-ocean" : "text-white"}`}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Chip({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      className={`px-5 py-3 rounded-full border ${selected ? "bg-ocean border-ocean" : "bg-white border-[#E3E7E0]"}`}
    >
      <Text
        className={`text-xs font-semibold ${selected ? "text-white" : "text-[#6B776F]"}`}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Heading({
  title,
  sub,
  action,
  onAction,
}: {
  title: string;
  sub?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between mb-5 gap-3">
      <View className="flex-1">
        <Text className="text-2xl font-semibold text-ink tracking-tight">
          {title}
        </Text>
        {!!sub && (
          <Text className="text-muted text-sm mt-2 leading-5">{sub}</Text>
        )}
      </View>
      {!!action && (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          className="py-3"
        >
          <Text className="text-ocean text-xs font-semibold">{action} ↗</Text>
        </Pressable>
      )}
    </View>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-3xl p-5 border border-[#E6EAE2] mb-4">
      {children}
    </View>
  );
}
export function Badge({
  text,
  warm = false,
}: {
  text: string;
  warm?: boolean;
}) {
  return (
    <View
      className={`self-start rounded-full px-3 py-1.5 ${warm ? "bg-[#FFF1E2]" : "bg-mint"}`}
    >
      <Text
        className={`text-[10px] font-bold tracking-wide ${warm ? "text-[#A36736]" : "text-ocean"}`}
      >
        {text}
      </Text>
    </View>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
}) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold text-ink mb-2">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        placeholderTextColor="#99A29A"
        className="border border-[#DCE3DA] rounded-xl p-4 bg-white text-ink text-sm"
      />
    </View>
  );
}
export function Row({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      className="flex-row items-center justify-between py-4 border-b border-[#EEF0E9] gap-4"
    >
      <Text className="text-sm text-ink flex-1">{title}</Text>
      <Text
        className="text-xs text-muted text-right"
        style={{ maxWidth: "60%" }}
      >
        {detail}
        {onPress ? "  ›" : ""}
      </Text>
    </Pressable>
  );
}
export function VehicleCard({
  vehicle,
  rentalDates,
}: {
  vehicle: Vehicle;
  rentalDates?: RentalDates;
}) {
  const { favorites, toggleFavorite } = useApp();
  const openVehicle = () =>
    router.push({
      pathname: "/vehicle/[id]",
      params: { id: vehicle.id, ...rentalDates },
    });
  return (
    <View
      className="bg-white rounded-3xl overflow-hidden border border-[#E2E6DE] flex-1"
      style={{ minWidth: 240 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${vehicle.name}`}
        onPress={openVehicle}
      >
        <Image
          source={vehicle.image}
          accessibilityLabel={vehicle.name}
          style={{ width: "100%", height: 190 }}
          resizeMode="cover"
        />
        <View className="absolute top-4 left-4 bg-white/95 px-3 py-2 rounded-lg">
          <Text className="text-[8px] font-bold tracking-widest text-ocean">
            {vehicle.tag}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          favorites.includes(vehicle.id) ? "Remove from saved" : "Save vehicle"
        }
        onPress={() => toggleFavorite(vehicle.id)}
        className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white items-center justify-center"
      >
        <AppIcon
          name={favorites.includes(vehicle.id) ? "heart-filled" : "heart"}
          size={21}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={openVehicle}
        className="p-5"
      >
        <View className="flex-row justify-between items-center">
          <Text className="text-[17px] font-semibold text-ink">
            {vehicle.name}
          </Text>
          <Text className="text-xs text-ink">
            <Text className="text-[#DBA251]">★</Text> {vehicle.rating}
          </Text>
        </View>
        <Text className="text-xs text-muted mt-2">
          {vehicle.year} · {vehicle.type} · {vehicle.transmission}
        </Text>
        <View className="flex-row gap-3 mt-4 mb-4">
          <Text className="text-[11px] text-muted">
            ♧ {vehicle.seats} seats
          </Text>
          <Text className="text-[11px] text-muted">◉ {vehicle.fuel}</Text>
          <Text className="text-[11px] text-muted">⌖ {vehicle.area}</Text>
        </View>
        <View className="flex-row items-end justify-between border-t border-[#EDF0E8] pt-4">
          <Text className="text-xl font-bold text-ocean">
            {money(vehicle.price)}
            <Text className="text-xs font-normal text-muted"> / day</Text>
          </Text>
          <View className="bg-mint rounded-full w-8 h-8 items-center justify-center">
            <Icon name="arrow" size={17} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
export function Brand() {
  return <AppLogo />;
}
export function Avatar() {
  const { name } = useApp();
  return (
    <View className="w-9 h-9 rounded-full bg-[#E9D9C5] items-center justify-center border-2 border-white">
      <Text className="text-xs font-bold text-[#745C40]">
        {name
          .split(" ")
          .map((s) => s[0])
          .slice(0, 2)
          .join("")}
      </Text>
    </View>
  );
}
export function Screen({
  children,
  title,
  subtitle,
  back = false,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const path = usePathname();
  const {
    mode,
    modes,
    setMode,
    toast,
    name,
    signedIn,
    loading,
    error,
    refresh,
  } = useApp();
  const showNavigation = signedIn && !path.startsWith("/auth");
  const nav =
    mode === "Renter"
      ? [
          ["explore", "Explore", renterHomeHref],
          ["trips", "My trips", "/trips"],
          ["heart", "Saved", "/saved"],
          ["messages", "Messages", "/messages"],
          ["profile", "Profile", "/profile"],
        ]
      : [
          ["dashboard", "Dashboard", "/provider"],
          [
            "vehicles",
            mode === "Owner" ? "Vehicles" : "My trips",
            mode === "Owner" ? "/vehicles" : "/trips",
          ],
          [
            "trips",
            mode === "Owner" ? "Bookings" : "Availability",
            mode === "Owner" ? "/trips" : "/availability",
          ],
          ["messages", "Messages", "/messages"],
          ["earnings", "Earnings", "/earnings"],
        ];
  const navItem = ([icon, label, href]: string[], mobile: boolean) => {
    const active = path === href;
    return (
      <Pressable
        key={label}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={() => {
          if (active) return;
          if (
            mobile &&
            Platform.OS !== "web" &&
            nav.some((item) => item[2] === path)
          ) {
            router.replace(href as Href);
          } else {
            router.navigate(href as Href);
          }
        }}
        className={
          mobile
            ? `items-center justify-center flex-1 min-h-[60px] py-2 gap-1 mx-1 my-1 rounded-xl ${active ? "bg-mint" : "bg-transparent"}`
            : `flex-row items-center gap-4 rounded-xl px-5 py-4 mb-2 ${active ? "bg-[#E8EFE8]" : ""}`
        }
      >
        <View className={mobile ? "w-12 h-8 items-center justify-center" : ""}>
          <Icon
            name={icon}
            color={active ? "#164E43" : "#8A928A"}
            size={mobile ? 23 : 21}
          />
        </View>
        <Text
          className={`${mobile ? "text-[9px]" : "text-[13px]"} ${active ? "font-bold text-ocean" : "text-muted"}`}
        >
          {label}
        </Text>
      </Pressable>
    );
  };
  return (
    <SafeAreaView className="flex-1 bg-sand" edges={["top", "bottom"]}>
      <View className="flex-1 flex-row">
        {wide && showNavigation && (
          <View className="w-[235px] bg-[#FCFCF8] border-r border-[#E6E9DF] px-6 pt-10 pb-6">
            <Brand />
            <Text className="text-[9px] tracking-[2px] text-muted mt-12 mb-5 px-5">
              YOUR ISLAND COMPANION
            </Text>
            {nav.map((item) => navItem(item, false))}
            <View className="mt-auto">
              <View className="rounded-2xl bg-[#EEF1E8] p-5 mb-5">
                <Text className="text-lg mb-3">☀</Text>
                <Text className="font-semibold text-ink text-sm">
                  A little island freedom.
                </Text>
                <Text className="text-xs text-muted mt-2 leading-5">
                  Good roads. Great memories.{"\n"}Your adventure starts here.
                </Text>
              </View>
              <Pressable
                onPress={() => router.push("/profile")}
                className="flex-row gap-3 items-center"
              >
                <Avatar />
                <View>
                  <Text className="text-xs font-semibold text-ink">{name}</Text>
                  <Text className="text-[10px] text-muted mt-1">
                    {mode} account ⌄
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}
        <View className="flex-1">
          {showNavigation && (
            <View
              className={`flex-row items-center justify-between border-b border-[#E7EADF] bg-[#FCFCF8] ${wide ? "px-10 py-5" : "px-5 py-4"}`}
            >
              {wide ? (
                <View className="flex-row gap-2 items-center">
                  <Icon name="pin" size={18} />
                  <Text className="text-xs text-ink">
                    Camotes Islands, Cebu
                  </Text>
                  <Text className="text-muted text-xs">⌄</Text>
                </View>
              ) : (
                <Brand />
              )}
              <View
                className={`flex-row items-center ${wide ? "gap-5" : "gap-2"}`}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (!signedIn) {
                      router.push("/auth");
                      return;
                    }
                    if (modes.length === 1) {
                      router.push("/profile");
                      return;
                    }
                    const next =
                      modes[(modes.indexOf(mode) + 1) % modes.length];
                    void setMode(next)
                      .then(() =>
                        router.push(
                          next === "Renter" ? renterHomeHref : "/provider",
                        ),
                      )
                      .catch((e) => toast(e.message));
                  }}
                  className="bg-mint rounded-full px-3 py-2"
                >
                  <Text className="text-[10px] font-semibold text-ocean">
                    {mode} mode ⇄
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Notifications"
                  onPress={() => router.push("/notifications")}
                >
                  <Icon name="bell" />
                </Pressable>
                {wide && <Avatar />}
              </View>
            </View>
          )}
          <ScrollView
            contentContainerStyle={{
              padding: wide ? 36 : 20,
              paddingBottom: 40,
              maxWidth: 1500,
              width: "100%",
              alignSelf: "center",
            }}
            keyboardShouldPersistTaps="handled"
          >
            <MotionView enabled={Platform.OS === "web"}>
              {back && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.canGoBack()
                      ? router.back()
                      : router.replace(renterHomeHref)
                  }
                  className="mb-5"
                >
                  <Text className="text-ocean text-sm">← Back</Text>
                </Pressable>
              )}
              {!!title && <Heading title={title} sub={subtitle} />}
              {loading && (
                <Text className="text-xs text-muted mb-4">
                  Connecting to your island…
                </Text>
              )}
              {!!error && (
                <View className="bg-[#FFF1E2] rounded-2xl p-4 mb-4">
                  <Text
                    accessibilityRole="alert"
                    className="text-sm text-ink mb-3"
                  >
                    {error}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void refresh()}
                  >
                    <Text className="text-sm text-ocean font-semibold">
                      Retry connection
                    </Text>
                  </Pressable>
                </View>
              )}
              {children}
              <View className="mt-10 flex-row justify-between border-t border-[#E0E5DA] pt-5">
                <Text className="text-[10px] text-muted">
                  Made for the island. Made for you.
                </Text>
                <Text className="text-[9px] text-muted">
                  CAMOTESDRIVE © 2026
                </Text>
              </View>
            </MotionView>
          </ScrollView>
          {!wide && showNavigation && (
            <View className="flex-row bg-[#FCFCF8] border-t border-[#E1E6DA]">
              {nav.map((item) => navItem(item, true))}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

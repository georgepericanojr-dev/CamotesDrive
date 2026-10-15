import { Image } from "expo-image";

const icons = {
  "arrow-left": require("../../../assets/icons/arrow-left.svg"),
  "arrow-right": require("../../../assets/icons/arrow-right.svg"),
  "arrow-up-right": require("../../../assets/icons/arrow-up-right.svg"),
  banknote: require("../../../assets/icons/banknote.svg"),
  bell: require("../../../assets/icons/bell.svg"),
  "calendar-off": require("../../../assets/icons/calendar-off.svg"),
  calendar: require("../../../assets/icons/calendar.svg"),
  camera: require("../../../assets/icons/camera.svg"),
  car: require("../../../assets/icons/car.svg"),
  "check-check": require("../../../assets/icons/check-check.svg"),
  "check-circle": require("../../../assets/icons/check-circle.svg"),
  check: require("../../../assets/icons/check.svg"),
  "chevron-down": require("../../../assets/icons/chevron-down.svg"),
  "chevron-right": require("../../../assets/icons/chevron-right.svg"),
  "clipboard-list": require("../../../assets/icons/clipboard-list.svg"),
  clock: require("../../../assets/icons/clock.svg"),
  compass: require("../../../assets/icons/compass.svg"),
  "eye-off": require("../../../assets/icons/eye-off.svg"),
  eye: require("../../../assets/icons/eye.svg"),
  "file-text": require("../../../assets/icons/file-text.svg"),
  flag: require("../../../assets/icons/flag.svg"),
  fuel: require("../../../assets/icons/fuel.svg"),
  "heart-filled": require("../../../assets/icons/heart-filled.svg"),
  heart: require("../../../assets/icons/heart.svg"),
  "help-circle": require("../../../assets/icons/help-circle.svg"),
  home: require("../../../assets/icons/home.svg"),
  "id-card": require("../../../assets/icons/id-card.svg"),
  image: require("../../../assets/icons/image.svg"),
  info: require("../../../assets/icons/info.svg"),
  "layout-dashboard": require("../../../assets/icons/layout-dashboard.svg"),
  lock: require("../../../assets/icons/lock.svg"),
  "log-out": require("../../../assets/icons/log-out.svg"),
  mail: require("../../../assets/icons/mail.svg"),
  "map-pin": require("../../../assets/icons/map-pin.svg"),
  menu: require("../../../assets/icons/menu.svg"),
  "message-circle": require("../../../assets/icons/message-circle.svg"),
  motorcycle: require("../../../assets/icons/motorcycle.svg"),
  navigation: require("../../../assets/icons/navigation.svg"),
  payout: require("../../../assets/icons/payout.svg"),
  pencil: require("../../../assets/icons/pencil.svg"),
  phone: require("../../../assets/icons/phone.svg"),
  plus: require("../../../assets/icons/plus.svg"),
  receipt: require("../../../assets/icons/receipt.svg"),
  refresh: require("../../../assets/icons/refresh.svg"),
  save: require("../../../assets/icons/save.svg"),
  search: require("../../../assets/icons/search.svg"),
  seats: require("../../../assets/icons/seats.svg"),
  send: require("../../../assets/icons/send.svg"),
  settings: require("../../../assets/icons/settings.svg"),
  "shield-check": require("../../../assets/icons/shield-check.svg"),
  shield: require("../../../assets/icons/shield.svg"),
  sliders: require("../../../assets/icons/sliders.svg"),
  "star-filled": require("../../../assets/icons/star-filled.svg"),
  star: require("../../../assets/icons/star.svg"),
  "steering-wheel": require("../../../assets/icons/steering-wheel.svg"),
  suv: require("../../../assets/icons/suv.svg"),
  "switch-role": require("../../../assets/icons/switch-role.svg"),
  transmission: require("../../../assets/icons/transmission.svg"),
  trash: require("../../../assets/icons/trash.svg"),
  "triangle-alert": require("../../../assets/icons/triangle-alert.svg"),
  upload: require("../../../assets/icons/upload.svg"),
  "user-block": require("../../../assets/icons/user-block.svg"),
  user: require("../../../assets/icons/user.svg"),
  users: require("../../../assets/icons/users.svg"),
  van: require("../../../assets/icons/van.svg"),
  wallet: require("../../../assets/icons/wallet.svg"),
  "x-circle": require("../../../assets/icons/x-circle.svg"),
  x: require("../../../assets/icons/x.svg"),
} as const;
export type AppIconName = keyof typeof icons;

export function AppIcon({
  name,
  size = 21,
  color = "#164E43",
}: {
  name: AppIconName;
  size?: number;
  color?: string;
}) {
  return (
    <Image
      accessible={false}
      source={icons[name]}
      contentFit="contain"
      tintColor={color}
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  );
}

export function AppLogo({
  white = false,
  compact = false,
  width = 172,
}: {
  white?: boolean;
  compact?: boolean;
  width?: number;
}) {
  return (
    <Image
      accessible
      accessibilityLabel="CamotesDrive"
      source={
        compact
          ? require("../../../assets/branding/logo-mark.svg")
          : white
            ? require("../../../assets/branding/logo-white.svg")
            : require("../../../assets/branding/logo.svg")
      }
      contentFit="contain"
      tintColor={compact && white ? "#FFFFFF" : undefined}
      style={{
        width: compact ? 44 : width,
        height: compact ? 44 : (width * 112) / 455,
      }}
    />
  );
}

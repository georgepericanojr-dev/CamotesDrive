export type MotionPattern = "peer" | "detail" | "task";

const PEER_ROUTES = new Set([
  "index",
  "explore",
  "profile",
  "saved",
  "trips",
  "messages",
  "provider",
  "vehicles",
  "availability",
  "earnings",
  "admin",
  "auth",
  "auth/callback",
]);
const TASK_ROUTES = new Set(["booking", "listing"]);

export function routeMotion(route: string): MotionPattern {
  if (PEER_ROUTES.has(route)) return "peer";
  if (TASK_ROUTES.has(route)) return "task";
  return "detail";
}

export function stackMotion(
  route: string,
  reducedMotion: boolean,
  mobile = false,
) {
  const pattern = routeMotion(route);
  const animation: "none" | "fade" | "slide_from_right" = reducedMotion
    ? "none"
    : mobile
      ? "fade"
      : "slide_from_right";
  return {
    animation,
    animationDuration: reducedMotion ? 0 : mobile ? 180 : 220,
    animationTypeForReplace: "push" as const,
    // Long forms use their explicit Back action instead of swipe dismissal.
    gestureEnabled: !mobile && pattern === "detail",
    animationMatchesGesture: !mobile,
  };
}

export type Route = {
  method: string;
  pattern: RegExp;
  resource?: string;
  action?: string;
  public?: boolean;
  idKey?: string;
};
// Exported independently so route/method/auth behavior can be tested in Node.
export const routes: Route[] = [
  {
    method: "GET",
    pattern: /^\/vehicles$/,
    resource: "vehicles",
    public: true,
  },
  {
    method: "GET",
    pattern: /^\/vehicles\/([^/]+)$/,
    resource: "vehicles",
    public: true,
  },
  {
    method: "GET",
    pattern: /^\/settings$/,
    resource: "settings",
    public: true,
  },
  {
    method: "GET",
    pattern: /^\/locations$/,
    resource: "locations",
    public: true,
  },
  ...[
    "me",
    "owned-vehicles",
    "saved",
    "bookings",
    "notifications",
    "documents",
    "availability",
    "drivers",
    "earnings",
  ].map((path) => ({
    method: "GET",
    pattern: new RegExp(`^/${path}$`),
    resource: path === "owned-vehicles" ? "owned_vehicles" : path,
  })),
  { method: "GET", pattern: /^\/bookings\/([^/]+)$/, resource: "booking" },
  {
    method: "GET",
    pattern: /^\/bookings\/([^/]+)\/messages$/,
    resource: "chat",
  },
  {
    method: "GET",
    pattern: /^\/admin\/([^/]+)$/,
    resource: "admin",
    idKey: "section",
  },
  ...Object.entries({
    "/me": "profile.update",
    "/me/mode": "profile.mode",
    "/me/deletion-request": "profile.delete_request",
    "/roles": "roles.request",
    "/favorites": "favorite.set",
    "/driver-profile": "driver.update",
    "/vehicles": "vehicle.save",
    "/documents": "document.submit",
    "/availability": "availability.save",
    "/bookings/quote": "booking.quote",
    "/bookings": "booking.request",
    "/payments": "payment.submit",
    "/settlements": "payment.settle",
    "/messages": "message.send",
    "/notifications/read": "notification.read",
    "/reviews": "review.submit",
    "/blocks": "block.set",
    "/reports": "report.submit",
  }).map(([path, action]) => ({
    method: "POST",
    pattern: new RegExp(`^${path}$`),
    action,
  })),
  ...["photo", "submit", "deactivate", "delete"].map((a) => ({
    method: "POST",
    pattern: new RegExp(`^/vehicles/([^/]+)/${a}$`),
    action: `vehicle.${a}`,
  })),
  ...["accept", "decline", "cancel", "start", "complete", "en_route"].map(
    (a) => ({
      method: "POST",
      pattern: new RegExp(`^/bookings/([^/]+)/${a}$`),
      action: `booking.${a}`,
    }),
  ),
  {
    method: "POST",
    pattern: /^\/bookings\/([^/]+)\/handovers$/,
    action: "handover.save",
  },
  ...["confirm", "reject"].map((a) => ({
    method: "POST",
    pattern: new RegExp(`^/payments/([^/]+)/${a}$`),
    action: `payment.${a}`,
  })),
  ...Object.entries({
    documents: "admin.document.review",
    roles: "admin.role.review",
    vehicles: "admin.vehicle.review",
    users: "admin.user.status",
    disputes: "admin.dispute.update",
    reviews: "admin.review.hide",
  }).map(([p, action]) => ({
    method: "POST",
    pattern: new RegExp(`^/admin/${p}/([^/]+)$`),
    action,
    idKey: p === "roles" ? "user_id" : "id",
  })),
  {
    method: "POST",
    pattern: /^\/admin\/settings$/,
    action: "admin.settings.update",
  },
  {
    method: "POST",
    pattern: /^\/admin\/payouts$/,
    action: "admin.payout.record",
  },
];
export function resolveRoute(method: string, path: string) {
  for (const route of routes) {
    const match = route.pattern.exec(path);
    if (match && route.method === method)
      return { ...route, captured: match[1] };
  }
  return null;
}
export function databaseStatus(code: string) {
  if (code === "42501") return 403;
  if (code === "P0002") return 404;
  if (code === "P0429") return 429;
  if (["23505", "23P01", "40001", "40P01"].includes(code)) return 409;
  if (code === "PGRST202" || code === "42P01" || code === "42883") return 503;
  return 422;
}

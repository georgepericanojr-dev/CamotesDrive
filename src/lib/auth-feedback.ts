export type AuthMode = "login" | "register" | "reset";
export type AuthField = "email" | "password" | "name" | "consent";

export interface AuthFields {
  email: string;
  password: string;
  name: string;
  consent: boolean;
}

export type AuthFieldErrors = Partial<Record<AuthField, string>>;

function isEmailAddress(value: string): boolean {
  if (/\s/.test(value)) return false;
  const parts = value.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (
    !local ||
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
  ) {
    return false;
  }
  const labels = domain.split(".");
  return (
    labels.length >= 2 &&
    labels.every((label) =>
      /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label),
    ) &&
    labels[labels.length - 1].length >= 2 &&
    /[a-zA-Z]/.test(labels[labels.length - 1])
  );
}

/** Validate without changing the password: spaces can be part of a valid one. */
export function validateAuthForm(
  mode: AuthMode,
  fields: AuthFields,
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const email = fields.email.trim();

  if (!email) errors.email = "Enter your email address.";
  else if (email.length > 254)
    errors.email = "Email address must be 254 characters or fewer.";
  else if (!isEmailAddress(email))
    errors.email = "Enter a valid email address, such as name@example.com.";

  if (mode !== "reset") {
    if (!fields.password.trim()) errors.password = "Enter your password.";
    else if (mode === "register" && fields.password.length < 8)
      errors.password = "Use at least 8 characters for your password.";
  }

  if (mode === "register") {
    const name = fields.name.trim();
    if (!name) errors.name = "Enter your full name.";
    else if (name.length > 120)
      errors.name = "Full name must be 120 characters or fewer.";
    if (!fields.consent)
      errors.consent =
        "Accept the Terms of Service and Privacy Policy to continue.";
  }

  return errors;
}

const errorsByCode: Record<string, string> = {
  invalid_credentials:
    "Incorrect email or password, or the account does not exist.",
  user_not_found: "Account does not exist. Check your email or sign up.",
  email_not_confirmed:
    "Verify your email before logging in. Check your inbox and spam folder.",
  phone_not_confirmed:
    "Verify your phone number before logging in. Contact support if you need help.",
  weak_password:
    "Choose a stronger password with at least 8 characters. Avoid common or compromised passwords.",
  user_already_exists:
    "An account with this email already exists. Log in or reset your password.",
  email_exists:
    "An account with this email already exists. Log in or reset your password.",
  signup_disabled:
    "New account registration is currently unavailable. Please contact support.",
  email_address_invalid: "Enter a valid email address you can receive mail at.",
  email_address_not_authorized:
    "Email delivery is not available for this address. Please contact support.",
  user_banned:
    "This account is suspended. Please contact support for assistance.",
  validation_failed: "Check your email and password, then try again.",
  captcha_failed: "Verification failed. Please try again.",
  session_expired: "Your session has expired. Log in again to continue.",
  session_not_found: "Your session has expired. Log in again to continue.",
  refresh_token_not_found:
    "Your session has expired. Log in again to continue.",
  refresh_token_already_used:
    "Your session has expired. Log in again to continue.",
  flow_state_expired: "This email link has expired. Request a new link.",
  flow_state_not_found:
    "This email link has expired or was already used. Request a new link.",
  otp_expired:
    "This email link has expired or was already used. Request a new link.",
};

const rateLimitCodes = new Set([
  "too_many_requests",
  "over_request_rate_limit",
  "over_email_send_rate_limit",
  "over_sms_send_rate_limit",
]);

function fallbackMessage(action: AuthMode | "logout"): string {
  switch (action) {
    case "login":
      return "We could not log you in. Please try again.";
    case "register":
      return "We could not create your account. Please try again.";
    case "reset":
      return "We could not send the password reset email. Please try again.";
    case "logout":
      return "We could not sign you out. Please try again.";
  }
}

/** Map stable Auth codes to safe messages; never show arbitrary server details. */
export function authErrorMessage(
  error: unknown,
  action: AuthMode | "logout",
): string {
  const source =
    error && typeof error === "object"
      ? (error as {
          code?: unknown;
          name?: unknown;
          status?: unknown;
          message?: unknown;
        })
      : {};
  const code = typeof source.code === "string" ? source.code : "";
  const name = typeof source.name === "string" ? source.name : "";
  const message = typeof source.message === "string" ? source.message : "";

  if (Object.prototype.hasOwnProperty.call(errorsByCode, code))
    return errorsByCode[code];
  if (rateLimitCodes.has(code) || source.status === 429)
    return "Too many attempts. Please wait a few minutes and try again.";
  if (code === "email_provider_disabled")
    return action === "register"
      ? "Email registration is currently unavailable. Please contact support."
      : "Email and password sign-in is currently unavailable. Please contact support.";

  if (
    code === "request_timeout" ||
    name === "AbortError" ||
    name === "TimeoutError"
  )
    return action === "logout"
      ? "Sign-out timed out. Check your connection and try again."
      : "The request took too long. Check your connection and try again.";

  // Fetch failures have no Auth API code; runtime names/messages differ by platform.
  if (
    name === "AuthRetryableFetchError" ||
    (!code &&
      /(?:failed to fetch|fetch failed|network request failed|networkerror|network error|load failed)/i.test(
        message,
      ))
  )
    return action === "logout"
      ? "Could not sign out. Check your internet connection and try again."
      : "Cannot connect right now. Check your internet connection and try again.";

  if (typeof source.status === "number" && source.status >= 500)
    return "The authentication service is temporarily unavailable. Please try again shortly.";

  return fallbackMessage(action);
}

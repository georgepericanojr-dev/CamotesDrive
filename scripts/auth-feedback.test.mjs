import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authErrorMessage,
  validateAuthForm,
} from "../src/lib/auth-feedback.ts";

const fields = (updates = {}) => ({
  email: "explorer@example.com",
  password: "Island day 2026",
  name: "Island Explorer",
  consent: true,
  ...updates,
});

test("empty login fields have individual, actionable errors", () => {
  assert.deepEqual(
    validateAuthForm("login", fields({ email: "", password: "" })),
    { email: "Enter your email address.", password: "Enter your password." },
  );
});

test("whitespace-only email and password are empty", () => {
  assert.deepEqual(
    validateAuthForm("login", fields({ email: " \t ", password: " \n " })),
    { email: "Enter your email address.", password: "Enter your password." },
  );
});

test("valid email accepts surrounding spaces, plus aliases and subdomains", () => {
  for (const email of [
    "  explorer@example.com  ",
    "george+holiday@travel.example.ph",
    "first.last@camotes-drive.com",
  ]) {
    assert.equal(validateAuthForm("login", fields({ email })).email, undefined);
  }
});

test("incomplete and malformed email addresses are rejected", () => {
  for (const email of [
    "explorer",
    "explorer@",
    "@example.com",
    "explorer@example",
    "explorer@example.c",
    "explorer@example..com",
    "explorer@-example.com",
    "explorer@example-.com",
    "explorer@example.123",
    "explorer@@example.com",
    "ex plorer@example.com",
    "explorer\n@example.com",
    ".explorer@example.com",
    "explorer.@example.com",
    "ex..plorer@example.com",
    "explorer@example.com/more",
    "explorer@example.com\nextra",
    `${"a".repeat(65)}@example.com`,
  ]) {
    assert.match(
      validateAuthForm("login", fields({ email })).email,
      /valid email address/,
      email,
    );
  }
});

test("email total length is capped at 254 characters", () => {
  const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  assert.equal(email.length, 254);
  assert.equal(validateAuthForm("login", fields({ email })).email, undefined);
  assert.equal(
    validateAuthForm("login", fields({ email: `${email}d` })).email,
    "Email address must be 254 characters or fewer.",
  );
});

test("login permits existing passwords shorter than registration minimum", () => {
  assert.deepEqual(
    validateAuthForm("login", fields({ password: "short" })),
    {},
  );
  assert.equal(
    validateAuthForm("register", fields({ password: "short" })).password,
    "Use at least 8 characters for your password.",
  );
});

test("validation preserves password spaces and never mutates input", () => {
  const input = Object.freeze(
    fields({ password: " a      ", email: " explorer@example.com " }),
  );
  assert.equal(input.password.length, 8);
  assert.deepEqual(validateAuthForm("register", input), {});
  assert.equal(input.password, " a      ");
  assert.equal(input.email, " explorer@example.com ");
});

test("registration requires a full name and consent", () => {
  assert.deepEqual(
    validateAuthForm("register", fields({ name: "  ", consent: false })),
    {
      name: "Enter your full name.",
      consent: "Accept the Terms of Service and Privacy Policy to continue.",
    },
  );
  assert.equal(
    validateAuthForm("register", fields({ name: "a".repeat(121) })).name,
    "Full name must be 120 characters or fewer.",
  );
  assert.equal(
    validateAuthForm("register", fields({ name: ` ${"a".repeat(120)} ` })).name,
    undefined,
  );
});

test("login does not require registration-only name or consent", () => {
  assert.deepEqual(
    validateAuthForm("login", fields({ name: "", consent: false })),
    {},
  );
});

test("password reset validates email alone", () => {
  assert.deepEqual(
    validateAuthForm(
      "reset",
      fields({ password: "", name: "", consent: false }),
    ),
    {},
  );
  assert.deepEqual(
    validateAuthForm("reset", fields({ email: "", password: "" })),
    { email: "Enter your email address." },
  );
});

test("invalid credentials do not invent whether the account exists", () => {
  assert.equal(
    authErrorMessage({ code: "invalid_credentials", status: 400 }, "login"),
    "Incorrect email or password, or the account does not exist.",
  );
  assert.equal(
    authErrorMessage({ code: "user_not_found" }, "login"),
    "Account does not exist. Check your email or sign up.",
  );
});

test("email confirmation errors give a recovery instruction", () => {
  assert.match(
    authErrorMessage({ code: "email_not_confirmed" }, "login"),
    /Verify your email.*inbox and spam/,
  );
});

test("rate-limit codes and HTTP 429 are handled consistently", () => {
  for (const code of [
    "too_many_requests",
    "over_request_rate_limit",
    "over_email_send_rate_limit",
    "over_sms_send_rate_limit",
  ]) {
    assert.equal(
      authErrorMessage({ code }, "login"),
      "Too many attempts. Please wait a few minutes and try again.",
    );
  }
  assert.equal(
    authErrorMessage({ status: 429 }, "reset"),
    "Too many attempts. Please wait a few minutes and try again.",
  );
});

test("registration errors explain duplicate accounts and weak passwords", () => {
  for (const code of ["user_already_exists", "email_exists"]) {
    assert.equal(
      authErrorMessage({ code }, "register"),
      "An account with this email already exists. Log in or reset your password.",
    );
  }
  assert.match(
    authErrorMessage({ code: "weak_password" }, "register"),
    /stronger password.*at least 8 characters/,
  );
});

test("disabled registration and email delivery are actionable", () => {
  assert.match(
    authErrorMessage({ code: "signup_disabled" }, "register"),
    /registration is currently unavailable/,
  );
  assert.match(
    authErrorMessage({ code: "email_provider_disabled" }, "register"),
    /Email registration/,
  );
  assert.match(
    authErrorMessage({ code: "email_provider_disabled" }, "login"),
    /Email and password sign-in/,
  );
  assert.match(
    authErrorMessage({ code: "email_address_not_authorized" }, "reset"),
    /Email delivery.*contact support/,
  );
});

test("native and browser network failures are friendly without leaking details", () => {
  for (const error of [
    new TypeError("Failed to fetch"),
    new TypeError("Network request failed"),
    new Error("Load failed"),
    { name: "AuthRetryableFetchError", message: "secret URL" },
  ]) {
    assert.equal(
      authErrorMessage(error, "login"),
      "Cannot connect right now. Check your internet connection and try again.",
    );
    assert.equal(
      authErrorMessage(error, "logout"),
      "Could not sign out. Check your internet connection and try again.",
    );
  }
});

test("timeouts distinguish signing out from login/reset requests", () => {
  for (const error of [
    { code: "request_timeout" },
    { name: "AbortError" },
    { name: "TimeoutError" },
  ]) {
    assert.equal(
      authErrorMessage(error, "reset"),
      "The request took too long. Check your connection and try again.",
    );
    assert.equal(
      authErrorMessage(error, "logout"),
      "Sign-out timed out. Check your connection and try again.",
    );
  }
});

test("known codes take precedence over arbitrary server error messages", () => {
  assert.equal(
    authErrorMessage(
      {
        code: "invalid_credentials",
        message:
          "private database detail: failed to fetch user admin@private.test",
      },
      "login",
    ),
    "Incorrect email or password, or the account does not exist.",
  );
});

test("unknown errors never expose arbitrary text and use action-specific fallback", () => {
  for (const error of [
    undefined,
    null,
    "private server text",
    { code: "unknown_code", message: "private database detail" },
    new Error("private database detail"),
    { code: "toString" },
  ]) {
    assert.equal(
      authErrorMessage(error, "login"),
      "We could not log you in. Please try again.",
    );
    assert.equal(
      authErrorMessage(error, "register"),
      "We could not create your account. Please try again.",
    );
    assert.equal(
      authErrorMessage(error, "reset"),
      "We could not send the password reset email. Please try again.",
    );
    assert.equal(
      authErrorMessage(error, "logout"),
      "We could not sign you out. Please try again.",
    );
  }
});

test("server outages are explained without displaying SQL or internal details", () => {
  assert.equal(
    authErrorMessage(
      { status: 503, message: "db trigger private detail" },
      "login",
    ),
    "The authentication service is temporarily unavailable. Please try again shortly.",
  );
});

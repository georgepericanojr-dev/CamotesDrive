import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { authErrorMessage } from "../src/lib/auth-feedback.ts";
import { signOutCurrentDevice } from "../src/lib/auth-session.ts";

// These fixtures exercise the installed SDK, its storage and Auth events. Fetch is
// injected into every client; no Supabase project or external network is used.
const USER_ID = "00000000-0000-4000-8000-000000000001";
const EXPIRES_AT = 4102444800;
const EMAIL = "explorer@example.test";
const PASSWORD = "  Island password 2026  ";
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const ACCESS_TOKEN = [
  encode({ alg: "HS256", typ: "JWT" }),
  encode({
    sub: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    iat: 1700000000,
    exp: EXPIRES_AT,
    session_id: "00000000-0000-4000-8000-000000000002",
  }),
  Buffer.from("test-fixture-signature").toString("base64url"),
].join(".");
const USER = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: EMAIL,
  email_confirmed_at: "2026-10-15T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Island Explorer" },
  identities: [],
  created_at: "2026-10-15T00:00:00Z",
  updated_at: "2026-10-15T00:00:00Z",
};
const sessionResponse = () => ({
  access_token: ACCESS_TOKEN,
  refresh_token: "fixture-refresh-token",
  token_type: "bearer",
  expires_in: EXPIRES_AT - Math.floor(Date.now() / 1000),
  expires_at: EXPIRES_AT,
  user: structuredClone(USER),
});
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Supabase-Api-Version": "2024-01-01",
    },
  });

let fixtureNumber = 0;
function fixture(t, { logout = "success" } = {}) {
  const storageKey = `camotes-auth-sdk-fixture-${++fixtureNumber}`;
  const stored = new Map();
  const requests = [];
  const clients = [];
  let removeError = null;
  const storage = {
    async getItem(key) {
      return stored.get(key) ?? null;
    },
    async setItem(key, value) {
      stored.set(key, value);
    },
    async removeItem(key) {
      if (key === storageKey && removeError) throw removeError;
      stored.delete(key);
    },
  };
  const fetchFixture = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const request = {
      url,
      method: init.method,
      headers: new Headers(init.headers),
      body: init.body ? JSON.parse(init.body) : null,
    };
    requests.push(request);
    if (
      url.origin === "https://auth-fixture.invalid" &&
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "password"
    ) {
      if (request.body?.email === EMAIL && request.body?.password === PASSWORD)
        return json(200, sessionResponse());
      return json(400, {
        code: "invalid_credentials",
        message: "Invalid login credentials",
      });
    }
    if (
      url.origin === "https://auth-fixture.invalid" &&
      url.pathname === "/auth/v1/logout"
    ) {
      if (logout === "network") throw new TypeError("Network request failed");
      if (logout === "unavailable")
        return json(503, {
          code: "unexpected_failure",
          message: "Fixture service unavailable",
        });
      return new Response(null, { status: 204 });
    }
    throw new Error(
      `Unexpected fixture request: ${request.method} ${url.pathname}`,
    );
  };
  const create = () => {
    const client = createClient(
      "https://auth-fixture.invalid",
      "public-fixture-key",
      {
        global: { fetch: fetchFixture },
        auth: {
          storage,
          storageKey,
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    clients.push(client);
    return client;
  };
  t.after(async () => {
    for (const client of clients) {
      await client.auth.dispose();
      await client.realtime.disconnect();
    }
  });
  return {
    client: create(),
    create,
    stored,
    storageKey,
    requests,
    failRemoval(error) {
      removeError = error;
    },
  };
}

async function login(client) {
  const response = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  assert.equal(response.error, null);
  assert.equal(response.data.user.id, USER_ID);
  return response;
}

test("actual SDK password login persists the session and emits SIGNED_IN", async (t) => {
  const f = fixture(t);
  const events = [];
  f.client.auth.onAuthStateChange((event, session) =>
    events.push({ event, session }),
  );
  const response = await login(f.client);
  assert.equal(response.data.session.access_token, ACCESS_TOKEN);
  const saved = JSON.parse(f.stored.get(f.storageKey));
  assert.equal(saved.user.id, USER_ID);
  assert.equal(saved.access_token, ACCESS_TOKEN);
  assert.equal(saved.refresh_token, "fixture-refresh-token");
  const signedIn = events.find(({ event }) => event === "SIGNED_IN");
  assert.equal(signedIn.session.user.id, USER_ID);
  assert.equal(
    (await f.client.auth.getSession()).data.session.user.id,
    USER_ID,
  );
  assert.equal(f.requests[0].method, "POST");
  assert.equal(f.requests[0].headers.get("apikey"), "public-fixture-key");
});

test("actual SDK preserves leading and trailing spaces in the password payload", async (t) => {
  const f = fixture(t);
  await login(f.client);
  assert.equal(f.requests[0].body.password, PASSWORD);
  assert.notEqual(f.requests[0].body.password, PASSWORD.trim());
});

test("actual SDK rejects a wrong password without persisting a session", async (t) => {
  const f = fixture(t);
  const events = [];
  f.client.auth.onAuthStateChange((event) => events.push(event));
  const response = await f.client.auth.signInWithPassword({
    email: EMAIL,
    password: "wrong password",
  });
  assert.equal(response.error.code, "invalid_credentials");
  assert.equal(response.data.session, null);
  assert.equal(response.data.user, null);
  assert.equal((await f.client.auth.getSession()).data.session, null);
  assert.equal(f.stored.has(f.storageKey), false);
  assert.equal(events.includes("SIGNED_IN"), false);
  assert.equal(
    authErrorMessage(response.error, "login"),
    "Incorrect email or password, or the account does not exist.",
  );
});

test("a nonexistent account uses the same SDK error without user enumeration", async (t) => {
  const f = fixture(t);
  const response = await f.client.auth.signInWithPassword({
    email: "missing@example.test",
    password: PASSWORD,
  });
  assert.equal(response.error.code, "invalid_credentials");
  assert.equal(response.data.session, null);
  assert.equal((await f.client.auth.getSession()).data.session, null);
  assert.equal(
    authErrorMessage(response.error, "login"),
    "Incorrect email or password, or the account does not exist.",
  );
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url.pathname, "/auth/v1/token");
});

test("actual SDK restores a persisted session after client recreation", async (t) => {
  const f = fixture(t);
  await login(f.client);
  await f.client.auth.dispose();
  const restored = f.create();
  const result = await restored.auth.getSession();
  assert.equal(result.error, null);
  assert.equal(result.data.session.user.id, USER_ID);
  assert.equal(result.data.session.access_token, ACCESS_TOKEN);
  assert.equal(
    f.requests.length,
    1,
    "restoration should not need a network refresh",
  );
});

test("confirmed current-device logout clears SDK storage and emits SIGNED_OUT", async (t) => {
  const f = fixture(t);
  await login(f.client);
  const events = [];
  f.client.auth.onAuthStateChange((event, session) =>
    events.push({ event, session }),
  );
  assert.deepEqual(await signOutCurrentDevice(f.client.auth), {
    remoteConfirmed: true,
  });
  assert.equal(f.stored.has(f.storageKey), false);
  assert.equal((await f.client.auth.getSession()).data.session, null);
  assert.deepEqual(
    events.filter(({ event }) => event === "SIGNED_OUT"),
    [{ event: "SIGNED_OUT", session: null }],
  );
  const request = f.requests.find(({ url }) =>
    url.pathname.endsWith("/logout"),
  );
  assert.equal(request.method, "POST");
  assert.equal(request.url.searchParams.get("scope"), "local");
  assert.equal(request.headers.get("Authorization"), `Bearer ${ACCESS_TOKEN}`);
  await f.client.auth.dispose();
  assert.equal((await f.create().auth.getSession()).data.session, null);
});

for (const logout of ["unavailable", "network"]) {
  test(`actual SDK clears local credentials after ${logout} logout failure`, async (t) => {
    const f = fixture(t, { logout });
    await login(f.client);
    const events = [];
    f.client.auth.onAuthStateChange((event) => events.push(event));
    assert.deepEqual(await signOutCurrentDevice(f.client.auth), {
      remoteConfirmed: false,
    });
    assert.equal((await f.client.auth.getSession()).data.session, null);
    assert.equal(f.stored.has(f.storageKey), false);
    assert.equal(events.filter((event) => event === "SIGNED_OUT").length, 1);
    const request = f.requests.find(({ url }) =>
      url.pathname.endsWith("/logout"),
    );
    assert.equal(request.url.searchParams.get("scope"), "local");
  });
}

test("storage removal failure throws while the SDK retains its local session", async (t) => {
  const f = fixture(t);
  await login(f.client);
  const events = [];
  f.client.auth.onAuthStateChange((event) => events.push(event));
  const storageError = new Error("Fixture storage removal failed");
  f.failRemoval(storageError);
  await assert.rejects(
    signOutCurrentDevice(f.client.auth),
    (error) => error === storageError,
  );
  assert.equal(f.stored.has(f.storageKey), true);
  assert.equal(
    (await f.client.auth.getSession()).data.session.user.id,
    USER_ID,
  );
  assert.equal(events.includes("SIGNED_OUT"), false);
});

test("helper throws the original remote error when a session remains", async () => {
  const original = new Error("Original sign-out error");
  const calls = [];
  await assert.rejects(
    signOutCurrentDevice({
      async signOut(options) {
        calls.push(options);
        return { error: original };
      },
      async getSession() {
        return { data: { session: sessionResponse() }, error: null };
      },
    }),
    (error) => error === original,
  );
  assert.deepEqual(calls, [{ scope: "local" }]);
});

test("helper throws the original remote error if session status cannot be read", async () => {
  const original = new Error("Original sign-out error");
  await assert.rejects(
    signOutCurrentDevice({
      async signOut() {
        return { error: original };
      },
      async getSession() {
        return {
          data: { session: null },
          error: new Error("Session read failed"),
        };
      },
    }),
    (error) => error === original,
  );
});

test("helper does not perform a redundant session read after confirmed sign-out", async () => {
  assert.deepEqual(
    await signOutCurrentDevice({
      async signOut(options) {
        assert.deepEqual(options, { scope: "local" });
        return { error: null };
      },
      async getSession() {
        assert.fail("No session recheck is needed after successful sign-out");
      },
    }),
    { remoteConfirmed: true },
  );
});

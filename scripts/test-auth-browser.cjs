/*
 * Browser regression checks for the real Expo web app and Supabase SDK.
 * Start Expo first: npx expo start --web --port 8091
 * Run: node scripts/test-auth-browser.cjs
 * Optional: AUTH_APP_URL, AUTH_BROWSER_PATH, AUTH_DEBUG_PORT.
 * Every remote browser request is intercepted; no hosted account is changed.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const appUrl = new URL(process.env.AUTH_APP_URL || 'http://localhost:8091');
if (!['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname)) {
  throw new Error('AUTH_APP_URL must use a local development host.');
}
const debugPort = Number(process.env.AUTH_DEBUG_PORT || 9339);
const candidates = [
  process.env.AUTH_BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executable = candidates.find(candidate => fs.existsSync(candidate));
if (!executable) throw new Error('Set AUTH_BROWSER_PATH to an installed Edge or Chromium executable.');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = path.resolve(`.expo/auth-demo-browser-${process.pid}`);
fs.mkdirSync(path.dirname(profile), { recursive: true });
const browser = spawn(executable, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });

let ws;
let send;
let closing = false;
let passed = 0;
const fixtureErrors = [];
const requests = { login: 0, logout: 0, admin: 0, unexpected: 0 };
let loginPlan = { code: 'invalid_credentials', message: 'Invalid login credentials' };
let logoutPlan = { success: true, delay: 0 };
let isAdmin = false;
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const fixtureEmail = 'demo-check@example.test';
const fixturePassword = 'Demo-check-only-2026!';
const fakeUser = () => ({
  id: userId, aud: 'authenticated', role: 'authenticated', email: fixtureEmail,
  email_confirmed_at: '2026-01-01T00:00:00Z', confirmed_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Demo Explorer' }, identities: [],
});
function fakeSession() {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({ sub: userId, role: 'authenticated', aud: 'authenticated',
      email: fixtureEmail, aal: 'aal1', iat: now, exp: now + 3600,
      session_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
    Buffer.from('browser-fixture-not-a-real-signature').toString('base64url'),
  ].join('.');
  return { access_token: token, refresh_token: 'browser-fixture-refresh-token',
    token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: fakeUser() };
}
async function eventually(fn, timeout = 30000, description = 'browser state') {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await delay(120);
  }
  throw new Error(`Timed out waiting for ${description}${last ? ': ' + last.message : ''}`);
}
async function fulfill(requestId, status, value) {
  await send('Fetch.fulfillRequest', {
    requestId, responseCode: status,
    responseHeaders: [
      { name: 'content-type', value: 'application/json' },
      { name: 'access-control-allow-origin', value: appUrl.origin },
      { name: 'access-control-allow-headers', value: 'authorization,apikey,content-type,x-client-info,x-supabase-api-version,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version' },
      { name: 'access-control-allow-methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
      { name: 'access-control-allow-credentials', value: 'true' },
      { name: 'cache-control', value: 'no-store' },
    ],
    body: Buffer.from(value === undefined ? '' : JSON.stringify(value)).toString('base64'),
  });
}
async function intercept({ requestId, request }) {
  const url = new URL(request.url);
  const auth = url.pathname.includes('/auth/v1/');
  const api = url.pathname.includes('/functions/v1/camotes-api');
  if (url.origin === appUrl.origin && !auth && !api) {
    await send('Fetch.continueRequest', { requestId });
    return;
  }
  if (request.method === 'OPTIONS' && (auth || api)) {
    await fulfill(requestId, 204);
    return;
  }
  if (auth && url.pathname.endsWith('/token')) {
    requests.login++;
    const current = { ...loginPlan };
    if (current.delay) await delay(current.delay);
    if (current.network) await send('Fetch.failRequest', { requestId, errorReason: 'ConnectionFailed' });
    else if (current.success) await fulfill(requestId, 200, fakeSession());
    else await fulfill(requestId, current.status || 400, {
      code: current.code, error_code: current.code, msg: current.message,
      message: current.message, error: current.code, error_description: current.message,
    });
    return;
  }
  if (auth && url.pathname.endsWith('/logout')) {
    requests.logout++;
    const current = { ...logoutPlan };
    if (current.delay) await delay(current.delay);
    await fulfill(requestId, current.success ? 204 : 500,
      current.success ? undefined : { code: 'unexpected_failure', message: 'Demo logout unavailable. Try again.' });
    return;
  }
  if (auth && url.pathname.endsWith('/user')) {
    await fulfill(requestId, 200, fakeUser());
    return;
  }
  if (api) {
    const resource = url.pathname.split('/functions/v1/camotes-api')[1] || '/';
    let data;
    if (resource === '/settings') data = { service_fee_bps: 1000, chauffeur_enabled: false };
    else if (resource === '/me') data = {
      profile: { id: userId, full_name: 'Demo Explorer', email: fixtureEmail,
        preferred_mode: 'renter', account_status: 'active', phone: '+639170000000' },
      roles: [{ user_id: userId, role: 'renter', status: 'active' },
        ...(isAdmin ? [{ user_id: userId, role: 'admin', status: 'active' }] : [])],
      favorites: [], driver_profile: null,
    };
    else if (resource.startsWith('/admin/')) {
      requests.admin++;
      if (!isAdmin) { await fulfill(requestId, 403, { error: 'Administrator role required', code: 'forbidden' }); return; }
      data = resource === '/admin/overview' ? { users: 1, bookings: 0, vehicles: 0 } : [];
    } else if (['/vehicles', '/owned-vehicles', '/bookings', '/saved', '/notifications'].includes(resource)) data = [];
    else { requests.unexpected++; await fulfill(requestId, 404, { error: 'Unexpected browser fixture route', code: 'fixture_route' }); return; }
    await fulfill(requestId, 200, { data });
    return;
  }
  // Fail closed for every other remote request, including unknown Auth routes.
  requests.unexpected++;
  await send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
}
async function run() {
  const tabs = await eventually(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(1000) });
    return response.ok && response.json();
  }, 20000, 'headless browser');
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let counter = 0;
  const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const task = pending.get(message.id);
    if (task) {
      pending.delete(message.id);
      clearTimeout(task.timer);
      message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
    }
    if (message.method === 'Fetch.requestPaused') {
      void intercept(message.params).catch(error => {
        if (!closing) fixtureErrors.push(error.message);
      });
    }
  });
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++counter;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 30000);
    timer.unref();
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const state = () => evaluate('({pathname:location.pathname,search:location.search,text:document.body.innerText})');
  const waitState = (predicate, description, timeout) => eventually(async () => {
    const current = await state();
    return predicate(current) && current;
  }, timeout, description);
  const check = message => { passed++; console.log('PASS ' + message); };
  const click = async (label, repeat = 1) => {
    const clicked = await evaluate(`(() => {
      const name = ${JSON.stringify(label)};
      const buttons = Array.from(document.querySelectorAll('[role="button"],button'));
      const button = buttons.find(element => element.getAttribute('aria-label') === name || element.textContent.trim() === name);
      if (!button) return false;
      for (let i = 0; i < ${repeat}; i++) button.click();
      return true;
    })()`);
    assert.ok(clicked, `Button not found: ${label}`);
  };
  const input = async (label, value) => {
    const found = await evaluate(`(() => {
      const field = Array.from(document.querySelectorAll('input')).find(element => element.getAttribute('aria-label') === ${JSON.stringify(label)});
      if (!field) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)});
      field.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    assert.ok(found, `Input not found: ${label}`);
    // React must commit each controlled field before the next button event.
    await delay(40);
  };
  const visit = async (route, predicate, description) => {
    await send('Page.navigate', { url: new URL(route, appUrl).href });
    return waitState(predicate, description || route, 90000);
  };
  const waitError = pattern => waitState(s => s.pathname === '/auth' && pattern.test(s.text), 'authentication feedback');
  const prepareLogin = async () => {
    await input('Email Address', fixtureEmail);
    await input('Password', fixturePassword);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  console.log('Testing the actual Expo app with isolated HTTP fixtures; no hosted account writes.');
  await visit('/', s => s.pathname === '/admin' && s.text.includes('Admin sign-in'), 'web admin entry');
  check('the web root automatically opens the administrator entry');
  let current = await visit('/auth', s => s.pathname === '/auth' && s.text.includes('LOGIN'), 'renter login');
  assert.ok(!current.text.includes('Where will the island take you?'));
  assert.ok(!current.text.includes('Renter mode') && !current.text.includes('My trips'));
  check('renter login hides navigation and role switching');

  await click('LOGIN');
  await waitError(/email.*(required|enter)|enter.*email/i);
  current = await state();
  assert.match(current.text, /password.*(required|enter)|enter.*password/i);
  assert.equal(requests.login, 0);
  check('empty email and password show validation before any Auth request');

  await input('Email Address', 'invalid-email');
  await input('Password', fixturePassword);
  await click('LOGIN');
  await waitError(/valid email/i);
  assert.equal(requests.login, 0);
  check('invalid email format is rejected locally');

  await input('Email Address', fixtureEmail);
  await input('Password', '');
  await click('LOGIN');
  await waitError(/password.*(required|enter)|enter.*password/i);
  assert.equal(requests.login, 0);
  check('an empty password is explained without contacting Auth');

  await input('Password', fixturePassword);
  assert.equal(await evaluate('document.querySelector(\'input[aria-label="Password"]\').type'), 'password');
  await click('Show password');
  assert.equal(await evaluate('document.querySelector(\'input[aria-label="Password"]\').type'), 'text');
  await click('Hide password');
  assert.equal(await evaluate('document.querySelector(\'input[aria-label="Password"]\').type'), 'password');
  check('Show/Hide Password toggles visibility and its accessible label');

  loginPlan = { code: 'invalid_credentials', message: 'Invalid login credentials' };
  await click('LOGIN');
  await waitError(/incorrect.*(email|username).*password/i);
  current = await state();
  assert.match(current.text, /account.*(exist|found)/i);
  check('invalid credentials explain incorrect details or an account that does not exist');

  loginPlan = { code: 'user_not_found', message: 'User not found' };
  await click('LOGIN');
  await waitError(/account.*(exist|found)/i);
  check('a specific Auth user-not-found response has an appropriate account message');

  loginPlan = { code: 'email_not_confirmed', message: 'Email not confirmed' };
  await click('LOGIN');
  await waitError(/verify|confirm.*email|email.*confirm/i);
  check('unverified accounts are prompted to verify their email');

  loginPlan = { network: true };
  await click('LOGIN');
  await waitError(/connection|network|reach|offline/i);
  check('network failure shows retry guidance and keeps the login screen usable');

  await prepareLogin();
  loginPlan = { success: true, delay: 1600 };
  const loginBefore = requests.login;
  await click('LOGIN', 2);
  await waitState(s => /signing in|please wait/i.test(s.text), 'login loading label');
  assert.ok(await evaluate('document.querySelector(\'input[aria-label="Email Address"]\').disabled'));
  assert.ok(await evaluate('!!document.querySelector(\'[role="progressbar"]\')'));
  check('slow login displays a spinner and disables form editing');
  current = await waitState(s => s.pathname === '/explore' && s.text.includes('Where will the island take you?'), 'dashboard after successful login');
  assert.match(current.text, /Successful login/i);
  assert.equal(requests.login - loginBefore, 1);
  check('successful login opens the dashboard with success feedback and ignores duplicate submits');
  await waitState(s => s.text.includes('Demo') && s.text.includes('Renter mode'), 'loaded dashboard identity');
  check('authenticated dashboard restores navigation, role switching, and the loaded identity');
  await visit('/explore', s => s.pathname === '/explore' && s.text.includes('Demo') && s.text.includes('Renter mode'), 'persisted login after reload');
  check('the SDK restores the authenticated session after a full page reload');

  const adminBefore = requests.admin;
  await visit('/admin', s => s.text.includes('Admin access required'), 'admin role restriction');
  assert.equal(requests.admin, adminBefore);
  check('a renter session cannot load administrator data');

  await visit('/profile', s => s.text.includes('Your little island corner') && s.text.includes('Sign out'), 'profile logout control');
  const logoutBefore = requests.logout;
  await click('Sign out');
  await waitState(s => s.text.includes('Sign out?') && s.text.includes('Yes, sign out'), 'logout confirmation');
  assert.equal(requests.logout, logoutBefore);
  await click('Cancel');
  await waitState(s => s.pathname === '/profile' && !s.text.includes('Sign out?'), 'cancelled logout');
  assert.equal(requests.logout, logoutBefore);
  check('logout opens a confirmation and Cancel keeps the account signed in without an Auth request');

  logoutPlan = { success: false, delay: 500 };
  await click('Sign out');
  await click('Yes, sign out', 2);
  await waitState(s => /Signing out/i.test(s.text), 'logout loading label');
  await waitState(s => s.pathname === '/auth' && /Signed out on this device/i.test(s.text), 'local logout after remote failure');
  assert.equal(requests.logout - logoutBefore, 1);
  current = await state();
  assert.match(current.text, /Server sign-out could not be confirmed/i);
  check('a failed remote logout honestly reports that the SDK has cleared the current device session');
  await visit('/trips', s => s.pathname === '/auth' && s.text.includes('LOGIN'), 'protected route after remote logout failure');
  check('the app does not restore credentials that the SDK cleared after remote logout failure');

  loginPlan = { success: true, delay: 350 };
  await prepareLogin();
  await click('LOGIN');
  await waitState(s => s.pathname === '/explore' && s.text.includes('Renter mode'), 'new login before successful logout');
  await visit('/profile', s => s.text.includes('Your little island corner') && s.text.includes('Sign out'), 'profile after renewed login');
  logoutPlan = { success: true, delay: 500 };
  await click('Sign out');
  await click('Yes, sign out');
  await waitState(s => s.pathname === '/auth' && s.text.includes('LOGIN') && /Signed out successfully/i.test(s.text), 'confirmed logout');
  check('only successful confirmed logout returns to login with a success notice');
  await visit('/trips', s => s.pathname === '/auth' && s.text.includes('LOGIN'), 'signed-out protected route');
  check('protected routes stay inaccessible after logout');

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await visit('/admin', s => s.text.includes('Admin sign-in'), 'admin entry after logout');
  await click('Sign in');
  await waitState(s => s.pathname === '/auth' && new URLSearchParams(s.search).get('next') === '/admin', 'admin return destination');
  isAdmin = true;
  loginPlan = { success: true, delay: 350 };
  await prepareLogin();
  await click('LOGIN');
  current = await waitState(s => s.pathname === '/admin' && s.text.includes('Overview') && s.text.includes('Live data.'), 'authenticated administrator dashboard');
  assert.match(current.text, /Successful login/i);
  await eventually(() => requests.admin > adminBefore, 10000, 'administrator data request');
  check('admin sign-in preserves its destination and loads role-authorized dashboard data');
  await click('Sign out');
  await click('Cancel');
  await waitState(s => s.pathname === '/admin' && !s.text.includes('Sign out?'), 'cancelled admin logout');
  check('administrator logout also supports Cancel');
  await click('Sign out');
  await click('Yes, sign out');
  await waitState(s => s.pathname === '/auth' && /Signed out successfully/i.test(s.text), 'confirmed administrator logout');
  check('administrator confirmed logout clears its session and returns to login');

  assert.deepEqual(fixtureErrors, []);
  assert.equal(requests.unexpected, 0, 'Every remote request must match an explicit fixture.');
  console.log(`${passed} actual browser checks passed; no real credentials or hosted account changes.`);
  closing = true;
  await send('Browser.close');
}

run().catch(async error => {
  console.error('FAIL ' + error.message);
  if (send && !closing) {
    try {
      const snapshot = await send('Runtime.evaluate', {
        expression: '({pathname:location.pathname,text:document.body.innerText.slice(0,1600)})', returnByValue: true,
      });
      console.error('Browser state:', JSON.stringify(snapshot.result.value));
    } catch { /* Browser may already have closed. */ }
  }
  process.exitCode = 1;
}).finally(() => {
  closing = true;
  ws?.close();
  browser.kill();
});

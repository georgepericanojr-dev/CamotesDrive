import assert from "node:assert/strict";
import { test } from "node:test";
import { stackMotion } from "../src/lib/motion.ts";

test("mobile navigation uses a short fade without sliding gestures", () => {
  for (const route of [
    "index",
    "profile",
    "saved",
    "trips",
    "messages",
    "provider",
    "vehicle/[id]",
    "trip/[id]",
    "chat/[id]",
    "booking",
    "listing",
    "auth",
    "auth/callback",
  ]) {
    const options = stackMotion(route, false, true);
    assert.equal(options.animation, "fade", route);
    assert.equal(options.animationDuration, 180, route);
    assert.equal(options.gestureEnabled, false, route);
    assert.equal(options.animationMatchesGesture, false, route);
  }
});
test("reduced motion disables mobile and desktop transitions", () => {
  assert.equal(stackMotion("profile", true, true).animation, "none");
  assert.equal(stackMotion("profile", true, true).animationDuration, 0);
  assert.equal(stackMotion("profile", true).animation, "none");
  assert.equal(stackMotion("vehicle/[id]", true).animationDuration, 0);
});
test("desktop configuration and long-form dismissal behavior remain available", () => {
  assert.equal(stackMotion("profile", false).animation, "slide_from_right");
  assert.equal(stackMotion("vehicle/[id]", false).gestureEnabled, true);
  assert.equal(stackMotion("booking", false).gestureEnabled, false);
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import {
  addDateDays,
  clampDateOnly,
  formatDateOnly,
  getDateFieldError,
  isDateOnly,
  parseDateOnly,
} from "../src/lib/date-only.ts";

test("date-only parsing keeps calendar dates and supports four-digit years", () => {
  for (const value of [
    "0001-01-01",
    "0099-12-31",
    "1900-02-28",
    "2000-02-29",
    "2024-02-29",
    "2026-10-15",
    "9999-12-31",
  ]) {
    const date = parseDateOnly(value);
    assert.ok(date instanceof Date, value);
    assert.equal(date.getFullYear(), Number(value.slice(0, 4)), value);
    assert.equal(date.getMonth() + 1, Number(value.slice(5, 7)), value);
    assert.equal(date.getDate(), Number(value.slice(8, 10)), value);
    assert.equal(formatDateOnly(date), value);
    assert.equal(isDateOnly(value), true);
  }
});

test("invalid calendar dates cannot silently roll into another month", () => {
  for (const value of [
    "2026-02-29",
    "2024-02-30",
    "1900-02-29",
    "2100-02-29",
    "2026-04-31",
    "2026-00-15",
    "2026-13-15",
    "2026-10-00",
    "2026-10-32",
    "0000-01-01",
  ]) {
    assert.equal(parseDateOnly(value), null, value);
    assert.equal(isDateOnly(value), false, value);
  }
});

test("partial dates, timestamps, and surrounding text are not date-only values", () => {
  for (const value of [
    "",
    "2026",
    "2026-10",
    "2026-1-01",
    "2026-01-1",
    "26-01-01",
    "10000-01-01",
    "15/10/2026",
    " 2026-10-15",
    "2026-10-15 ",
    "2026-10-15\n",
    "2026-10-15T09:00:00+08:00",
    "not a date",
  ]) {
    assert.equal(parseDateOnly(value), null, JSON.stringify(value));
    assert.equal(isDateOnly(value), false, JSON.stringify(value));
  }
});

test("formatting invalid native dates returns no date", () => {
  assert.equal(formatDateOnly(new Date(Number.NaN)), "");
});

test("adding days crosses leap days, month ends, and year ends", () => {
  for (const [value, offset, expected] of [
    ["2024-02-28", 1, "2024-02-29"],
    ["2024-02-28", 2, "2024-03-01"],
    ["2026-02-28", 1, "2026-03-01"],
    ["2000-02-28", 1, "2000-02-29"],
    ["1900-02-28", 1, "1900-03-01"],
    ["2026-04-30", 1, "2026-05-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2027-01-01", -1, "2026-12-31"],
    ["2024-03-01", -1, "2024-02-29"],
    ["0099-12-31", 1, "0100-01-01"],
    ["2026-10-15", 0, "2026-10-15"],
  ]) {
    assert.equal(addDateDays(value, offset), expected, `${value} + ${offset}`);
  }
});

test("day arithmetic rejects invalid dates, fractional days, and year overflow", () => {
  for (const [value, offset] of [
    ["", 1],
    ["2026-02-30", 1],
    ["2026-10-15", 0.5],
    ["2026-10-15", Number.NaN],
    ["2026-10-15", Number.POSITIVE_INFINITY],
    ["0001-01-01", -1],
    ["9999-12-31", 1],
  ]) {
    assert.equal(addDateDays(value, offset), "", `${value} + ${offset}`);
  }
});

test("date bounds include the exact minimum and maximum", () => {
  const min = "2026-10-15";
  const max = "2026-10-20";
  for (const value of [min, "2026-10-18", max]) {
    assert.equal(clampDateOnly(value, min, max), value);
    assert.equal(getDateFieldError(value, min, max), null);
  }
  assert.equal(clampDateOnly("2026-10-14", min, max), min);
  assert.equal(clampDateOnly("2026-10-21", min, max), max);
  assert.ok(getDateFieldError("2026-10-14", min, max));
  assert.ok(getDateFieldError("2026-10-21", min, max));
});

test("optional empty dates are accepted but malformed nonempty dates have errors", () => {
  assert.equal(getDateFieldError(""), null);
  assert.equal(clampDateOnly(""), "");
  assert.equal(clampDateOnly("2026-02-30"), "");
  assert.ok(getDateFieldError("2026-02-30"));
  assert.ok(getDateFieldError("2026-10"));
});

test("unusable bounds do not corrupt valid dates", () => {
  const value = "2026-10-15";
  assert.equal(clampDateOnly(value, "invalid", "invalid"), value);
  assert.equal(getDateFieldError(value, "invalid", "invalid"), null);
  assert.equal(clampDateOnly(value, "2026-10-20", "2026-10-10"), value);
  assert.equal(getDateFieldError(value, "2026-10-20", "2026-10-10"), null);
  assert.equal(clampDateOnly(value, "2026-10-16", "invalid"), "2026-10-16");
  assert.equal(clampDateOnly(value, "invalid", "2026-10-14"), "2026-10-14");
});

const helperUrl = new URL("../src/lib/date-only.ts", import.meta.url).href;

for (const timeZone of ["UTC", "Asia/Manila", "America/Los_Angeles"]) {
  test(`native picker dates and calendar arithmetic keep their day in ${timeZone}`, () => {
    // Native pickers use local calendar dates. Exercise the real helpers in
    // separate processes so the timezone changes before Date is initialized.
    const source = `
      import assert from 'node:assert/strict';
      import { addDateDays, formatDateOnly, parseDateOnly } from ${JSON.stringify(helperUrl)};
      for (const value of [
        '2024-02-29', '2026-03-07', '2026-03-08', '2026-03-09',
        '2026-10-15', '2026-10-31', '2026-11-01', '2026-11-02'
      ]) {
        const date = parseDateOnly(value);
        assert.ok(date);
        assert.equal(formatDateOnly(date), value);
        const nativeDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        assert.equal(formatDateOnly(nativeDate), value);
      }
      assert.equal(addDateDays('2026-03-07', 2), '2026-03-09');
      assert.equal(addDateDays('2026-10-31', 2), '2026-11-02');
      assert.equal(addDateDays('2026-03-09', -2), '2026-03-07');
      assert.equal(addDateDays('2026-11-02', -2), '2026-10-31');
    `;
    execFileSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "--eval", source],
      {
        env: { ...process.env, TZ: timeZone },
        stdio: "pipe",
      },
    );
  });
}

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

function load(path, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => {
      if (!(name in dependencies))
        throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  });
  return module.exports;
}
const dates = load("src/lib/date-only.ts");
const { rentalDatesFromParams, rentalEndForStart } = load(
  "src/lib/rental-dates.ts",
  { "./date-only": dates },
);

test("complete future dates survive the Explore-to-booking route unchanged", () => {
  const result = rentalDatesFromParams(
    "2026-10-16",
    "2026-10-18",
    "2026-10-16",
  );
  assert.equal(result.startDate, "2026-10-16");
  assert.equal(result.endDate, "2026-10-18");
});
test("injected, partial, reversed, past and impossible route dates are discarded", () => {
  for (const [start, end] of [
    [undefined, undefined],
    ["2026-10-16", ""],
    [["2026-10-16"], "2026-10-18"],
    ["2026-02-30", "2026-10-18"],
    ["2026-10-15", "2026-10-18"],
    ["2026-10-18", "2026-10-16"],
    ["2026-10-16", "2026-10-16"],
    ["2026-10-16T09:00:00+08:00", "2026-10-18"],
  ]) {
    assert.equal(rentalDatesFromParams(start, end, "2026-10-16"), null);
  }
  assert.equal(
    rentalDatesFromParams("2026-10-16", "2026-10-18", "invalid"),
    null,
  );
});
test("moving pickup preserves a valid return and repairs invalid rental lengths", () => {
  assert.equal(
    rentalEndForStart("2026-10-16", "2026-10-20", 2, 7),
    "2026-10-20",
  );
  assert.equal(
    rentalEndForStart("2026-10-16", "2026-10-17", 2, 7),
    "2026-10-18",
  );
  assert.equal(
    rentalEndForStart("2026-10-16", "2026-11-17", 2, 7),
    "2026-10-23",
  );
  assert.equal(rentalEndForStart("2026-10-16", "", 2, 7), "2026-10-18");
});
test("rental bounds use calendar days across leap years and year boundaries", () => {
  assert.equal(rentalEndForStart("2024-02-28", "", 2), "2024-03-01");
  assert.equal(rentalEndForStart("2026-12-31", "", 1), "2027-01-01");
});
test("bad listing bounds or invalid pickup dates cannot produce a range", () => {
  assert.equal(rentalEndForStart("not-a-date", "2026-10-20"), "");
  assert.equal(rentalEndForStart("2026-10-16", "", 0), "");
  assert.equal(rentalEndForStart("2026-10-16", "", 2, 1), "");
  assert.equal(rentalEndForStart("2026-10-16", "", 1.5), "");
});

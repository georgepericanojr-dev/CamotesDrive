import assert from "node:assert/strict";
import { test } from "node:test";
import {
  documentProgress,
  DOCUMENT_GUIDE,
  VERIFICATION_GOALS,
} from "../src/lib/verification-guide.ts";
const today = "2026-10-15";
const approved = {
  document_type: "or_cr",
  vehicle_id: "vehicle-a",
  status: "approved",
  next_reverification_on: "2027-01-01",
};

test("vehicle documents count only for the selected vehicle", () => {
  assert.equal(
    documentProgress([approved], "or_cr", "vehicle-a", today),
    "Approved",
  );
  assert.equal(
    documentProgress([approved], "or_cr", "vehicle-b", today),
    "Not uploaded",
  );
  assert.equal(
    documentProgress([approved], "or_cr", null, today),
    "Not uploaded",
  );
});
test("expiry and annual review dates cannot appear as approved", () => {
  assert.equal(
    documentProgress(
      [{ ...approved, expires_on: "2026-10-14" }],
      "or_cr",
      "vehicle-a",
      today,
    ),
    "Expired — upload again",
  );
  assert.equal(
    documentProgress(
      [{ ...approved, next_reverification_on: "2026-10-14" }],
      "or_cr",
      "vehicle-a",
      today,
    ),
    "Review needed",
  );
  assert.equal(
    documentProgress(
      [{ ...approved, issued_on: "2026-10-16" }],
      "or_cr",
      "vehicle-a",
      today,
    ),
    "Review needed",
  );
});
test("valid approval remains recognized while a replacement is pending", () => {
  assert.equal(
    documentProgress(
      [{ ...approved, status: "pending" }, approved],
      "or_cr",
      "vehicle-a",
      today,
    ),
    "Approved",
  );
});
test("account progress distinguishes missing, pending, and rejected documents", () => {
  assert.equal(
    documentProgress([], "government_id", null, today),
    "Not uploaded",
  );
  assert.equal(
    documentProgress(
      [{ document_type: "government_id", status: "pending" }],
      "government_id",
      null,
      today,
    ),
    "In review",
  );
  assert.equal(
    documentProgress(
      [{ document_type: "government_id", status: "rejected" }],
      "government_id",
      null,
      today,
    ),
    "Rejected — upload again",
  );
});
test("a license without expiry cannot appear as approved", () => {
  assert.equal(
    documentProgress(
      [{ ...approved, document_type: "drivers_license", vehicle_id: null }],
      "drivers_license",
      null,
      today,
    ),
    "Review needed",
  );
});
test("all standard checklist documents have readable labels and upload guidance", () => {
  for (const goal of Object.values(VERIFICATION_GOALS)) {
    for (const kind of goal.documents) {
      assert.ok(DOCUMENT_GUIDE[kind]?.label);
      assert.ok(DOCUMENT_GUIDE[kind]?.help);
    }
  }
  assert.deepEqual(VERIFICATION_GOALS.renter_chauffeured.documents, [
    "government_id",
  ]);
  assert.ok(
    VERIFICATION_GOALS.driver.documents.includes("professional_license"),
  );
});

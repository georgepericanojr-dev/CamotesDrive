import assert from "node:assert/strict";
import { test } from "node:test";
import { DOCUMENT_REVIEW_FIELDS, documentReviewPayload, reviewDraft } from "../src/lib/document-review.ts";

test("government ID configuration and payload contain only identity fields", () => {
  assert.deepEqual(DOCUMENT_REVIEW_FIELDS.government_id.map((f) => f.key), ["reference_number", "expires_on", "verified_date_of_birth"]);
  const payload = documentReviewPayload("government_id", { reference_number: " ID-1 ", plate_number: "WRONG", or_number: "WRONG", verified_date_of_birth: "1990-01-01" }, ["car"], true);
  assert.deepEqual(payload, { decision: "approved", reference_number: "ID-1", expires_on: null, verified_date_of_birth: "1990-01-01" });
});
test("drafts use the selected record's own fields and nested metadata", () => {
  const draft = reviewDraft({ document_type: "or_cr", plate_number: "ABC 123", reviewed_vehicle_classes: ["car"], review_details: { or_number: "OR-1", cr_number: "CR-2", insurer: "Wrong document" } });
  assert.equal(draft.or_number, "OR-1");
  assert.equal(draft.cr_number, "CR-2");
  assert.equal(draft.plate_number, "ABC 123");
  assert.equal(draft.insurer, undefined);
});
test("insurance saves policy details without identity or license fields", () => {
  const payload = documentReviewPayload("ctpl_insurance", { insurer: "Insurer", reference_number: "POL-1", verified_date_of_birth: "1990-01-01", plate_number: "ABC", issued_on: "2026-01-01", expires_on: "2027-01-01" }, ["car"], false);
  assert.deepEqual(payload.review_details, { insurer: "Insurer" });
  assert.equal(payload.vehicle_classes, undefined);
  assert.equal(payload.verified_date_of_birth, undefined);
  assert.equal(payload.issued_on, "2026-01-01");
});
test("professional driving review retains explicit classification and allowed classes", () => {
  const payload = documentReviewPayload("professional_license", { profession: "Driver", issuing_authority: "LTO" }, ["car", "airplane"], true);
  assert.equal(payload.license_kind, "professional");
  assert.deepEqual(payload.vehicle_classes, ["car"]);
  assert.equal(documentReviewPayload("professional_license", {}, ["car"], false).license_kind, undefined);
});
test("empty optional birth date is omitted rather than overwriting a verified profile", () => {
  assert.equal("verified_date_of_birth" in documentReviewPayload("government_id", {}, [], false), false);
});
test("unsupported document types cannot produce an approval payload", () => {
  assert.throws(() => documentReviewPayload("unknown", {}, [], false), /Unsupported/);
});

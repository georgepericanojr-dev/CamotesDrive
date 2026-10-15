export type ReviewField = {
  key: string;
  label: string;
  date?: boolean;
  optional?: boolean;
  detail?: boolean;
};
const field = (key: string, label: string, detail = false): ReviewField => ({
  key,
  label,
  optional: true,
  detail,
});
const date = (key: string, label: string, optional = true): ReviewField => ({
  key,
  label,
  date: true,
  optional,
});
const expiry = (optional = false) =>
  date("expires_on", "Verified expiry / validity date", optional);
const dob = date("verified_date_of_birth", "Verified birth date");
const reference = (label: string) => field("reference_number", label);
const plate = field("plate_number", "Verified vehicle / plate number");
export const DOCUMENT_REVIEW_FIELDS: Record<string, ReviewField[]> = {
  government_id: [reference("Reference / ID number"), expiry(true), dob],
  drivers_license: [reference("License number"), expiry(), dob],
  professional_license: [
    reference("License number"),
    field("profession", "Profession", true),
    field("issuing_authority", "Issuing authority", true),
    expiry(),
    dob,
  ],
  or_cr: [
    plate,
    field("or_number", "OR number", true),
    field("cr_number", "CR number", true),
    date("issued_on", "Registration date"),
    expiry(true),
  ],
  ctpl_insurance: [
    reference("Policy number"),
    plate,
    field("insurer", "Insurer", true),
    date("issued_on", "Policy start date"),
    expiry(),
  ],
  ltfrb_authority: [
    reference("Franchise / case reference"),
    plate,
    date("issued_on", "Authority valid from"),
    expiry(),
  ],
  passenger_insurance: [
    reference("Policy number"),
    field("insurer", "Insurer", true),
    field("coverage_details", "Coverage details", true),
    date("issued_on", "Effective date"),
    expiry(),
  ],
  business_permit: [
    reference("Permit number"),
    field("business_name", "Business name", true),
    field("issuing_authority", "Issuing LGU / authority", true),
    date("issued_on", "Issue date"),
    expiry(),
  ],
  dti_sec_registration: [
    reference("Registration number"),
    field("business_name", "Registered business name", true),
    field("issuing_authority", "Issuing authority (DTI or SEC)", true),
    date("issued_on", "Registration date"),
  ],
  pnp_clearance: [
    reference("Clearance / reference number"),
    field("issuing_authority", "Issuing authority", true),
    date("issued_on", "Issue date"),
    expiry(),
  ],
  nbi_clearance: [
    reference("Clearance / reference number"),
    field("issuing_authority", "Issuing authority", true),
    date("issued_on", "Issue date"),
    expiry(),
  ],
};
export const REVIEW_VEHICLE_CLASSES = ["car", "suv", "van", "motorcycle"];
export const isLicenseReview = (kind: string) =>
  ["drivers_license", "professional_license"].includes(kind);

export function reviewDraft(
  record: Record<string, unknown>,
): Record<string, string> {
  const details =
    record.review_details && typeof record.review_details === "object"
      ? (record.review_details as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    (DOCUMENT_REVIEW_FIELDS[String(record.document_type)] || []).map((f) => [
      f.key,
      String((f.detail ? details[f.key] : record[f.key]) ?? ""),
    ]),
  );
}

// Explicit allowlist prevents another document's hidden fields leaking into a decision.
export function documentReviewPayload(
  kind: string,
  draft: Record<string, string>,
  classes: string[],
  professional: boolean,
) {
  if (!DOCUMENT_REVIEW_FIELDS[kind]) throw new Error("Unsupported document type");
  const payload: Record<string, unknown> = { decision: "approved" };
  const details: Record<string, string> = {};
  for (const f of DOCUMENT_REVIEW_FIELDS[kind] || []) {
    const value = (draft[f.key] || "").trim();
    if (f.detail) details[f.key] = value;
    else if (f.key === "verified_date_of_birth") {
      if (value) payload[f.key] = value;
    } else payload[f.key] = value || null;
  }
  if (Object.keys(details).length) payload.review_details = details;
  if (isLicenseReview(kind))
    payload.vehicle_classes = classes.filter((c) =>
      REVIEW_VEHICLE_CLASSES.includes(c),
    );
  if (kind === "professional_license" && professional)
    payload.license_kind = "professional";
  return payload;
}

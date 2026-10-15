export const DOCUMENT_GUIDE: Record<string, { label: string; help: string }> = {
  government_id: {
    label: "Valid government-issued ID",
    help: "Upload a clear copy showing your full name, photo and date of birth. Include both sides if information is printed on the back.",
  },
  drivers_license: {
    label: "Driver’s license — self-drive",
    help: "Upload both sides of your valid driver’s license so your name, expiry date and allowed vehicle classes can be checked.",
  },
  professional_license: {
    label: "Professional driver’s license",
    help: "Required to provide driving services. Upload both sides, including the license classification, restrictions and expiry date. A non-professional license cannot activate Driver mode.",
  },
  nbi_clearance: {
    label: "NBI clearance",
    help: "Upload the complete, valid clearance with your name, reference number and validity details visible.",
  },
  pnp_clearance: {
    label: "PNP / police clearance",
    help: "Upload the complete, valid clearance with your name, reference number and validity details visible.",
  },
  or_cr: {
    label: "Vehicle registration — OR & CR",
    help: "Include the Official Receipt (OR) and Certificate of Registration (CR) for the selected vehicle in one PDF or image. Keep the plate and registration details readable.",
  },
  ctpl_insurance: {
    label: "CTPL vehicle insurance",
    help: "Upload the selected vehicle’s compulsory third-party liability insurance showing the vehicle details and coverage dates.",
  },
  ltfrb_authority: {
    label: "LTFRB franchise / provisional authority",
    help: "Upload the approved authority for this vehicle, showing its case number, plate number and validity dates.",
  },
  passenger_insurance: {
    label: "Passenger insurance policy",
    help: "Upload the selected vehicle’s passenger insurance policy showing its coverage and validity dates.",
  },
  business_permit: {
    label: "Business permit",
    help: "For a business-owned vehicle, upload the valid permit for the business that owns the listing.",
  },
  dti_sec_registration: {
    label: "DTI / SEC business registration",
    help: "For a business-owned vehicle, upload its DTI or SEC registration with the business name and registration number visible.",
  },
};

// Matches the standard required_documents groups in supabase_dbschema.md.
export const VERIFICATION_GOALS = {
  renter_self_drive: {
    label: "Rent & drive myself",
    help: "Verify your ID and license before a self-drive booking. Every additional driver needs their own verified license.",
    documents: ["government_id", "drivers_license"],
  },
  renter_chauffeured: {
    label: "Book with a driver",
    help: "As a passenger, you need a verified ID. You do not need a driver’s license to book with a driver.",
    documents: ["government_id"],
  },
  owner: {
    label: "List my vehicle",
    help: "Request the Owner role from Profile and verify your identity, then upload registration and insurance for each vehicle. Vehicle approval is separate from account verification.",
    documents: ["government_id"],
  },
  driver: {
    label: "Work as a driver",
    help: "Request the Driver role from Profile and submit these documents for administrator approval. Uploading files alone does not activate Driver mode.",
    documents: [
      "government_id",
      "professional_license",
      "nbi_clearance",
      "pnp_clearance",
    ],
  },
};
export type VerificationGoal = keyof typeof VERIFICATION_GOALS;
export const documentLabel = (kind: string) =>
  DOCUMENT_GUIDE[kind]?.label || kind.replaceAll("_", " ");

type Document = {
  document_type?: unknown;
  vehicle_id?: unknown;
  status?: unknown;
  expires_on?: unknown;
  issued_on?: unknown;
  next_reverification_on?: unknown;
};
export function documentProgress(
  documents: Document[],
  kind: string,
  vehicleId: string | null,
  today: string,
): string {
  const matching = documents.filter(
    (d) => d.document_type === kind && (d.vehicle_id || null) === vehicleId,
  );
  const expired = (d: Document) =>
    typeof d.expires_on === "string" && d.expires_on < today;
  const expiryValid = (d: Document) =>
    !expired(d) &&
    (typeof d.expires_on === "string" ||
      ["government_id", "or_cr", "dti_sec_registration"].includes(kind));
  if (
    matching.some(
      (d) =>
        d.status === "approved" &&
        expiryValid(d) &&
        (typeof d.issued_on !== "string" || d.issued_on <= today) &&
        typeof d.next_reverification_on === "string" &&
        d.next_reverification_on >= today,
    )
  )
    return "Approved";
  if (matching.some((d) => d.status === "pending" && !expired(d)))
    return "In review";
  if (matching.some((d) => d.status === "approved" && !expired(d)))
    return "Review needed";
  if (matching.some((d) => d.status === "expired" || expired(d)))
    return "Expired — upload again";
  if (matching.some((d) => d.status === "rejected"))
    return "Rejected — upload again";
  return "Not uploaded";
}

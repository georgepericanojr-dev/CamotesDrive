# Document-specific administrator review

## Apply the database update

1. Open the Supabase SQL Editor for the same project used by the app.
2. Paste and run the entire contents of `supabase/migrations/202610150004_document_review_fields.sql`. The original database schema and `202610150001_api.sql` must already be installed. The new migration is safe to reapply.
3. Reload the web app, refresh admin data, and open **Documents → Review**.

The existing API route still calls the same database RPC, so no Edge Function redeployment is required for this update. The migration has been checked locally; it has not been applied to your hosted project by this change.

Approval is disabled until the document response contains the new `review_details` column. This prevents an older RPC from silently ignoring the extra fields. Evidence viewing and rejection remain available.

## Fields by document type

| Document | Review fields |
| --- | --- |
| Government ID | Reference/ID number, optional expiry and optional verified birth date |
| Self-drive license | License number, expiry, optional birth date and verified vehicle classes |
| OR & CR | Plate, separate OR and CR numbers, optional registration date and optional validity end date |
| CTPL | Policy number, insured plate, insurer, policy start and expiry |
| LTFRB authority | Franchise/case reference, authorized plate, valid-from and expiry dates |
| Passenger insurance | Policy number, insurer, coverage details, effective and expiry dates |
| Business permit | Permit number, business name, issuing LGU/authority, issue and expiry dates |
| DTI/SEC | Registration number, business name, DTI/SEC authority and registration date |
| PNP/NBI clearance | Reference number, issuing authority, issue and validity/expiry dates |
| Professional driver's license | License number, profession, issuing authority, expiry, optional birth date, verified vehicle classes and explicit professional classification check |

Text details are optional when not available in the evidence. Existing platform policy still requires a current expiry/validity end date for licenses, insurance, authority, permits and clearances. Government ID and OR/CR expiry remain optional; DTI/SEC review does not require an expiry. Do not invent a printed expiry date: where a clearance has none, obtain an established validity policy before approving it.

CamotesDrive's `professional_license` means a **professional driver's license**, as required by its Driver mode eligibility rules. Other professional credentials cannot activate Driver mode. The professional license review therefore retains the vehicle-class and classification checks.

## Decisions and storage

- Private evidence is displayed separately from editable review fields.
- Entering data does not change verification status. **Approve reviewed document** makes the explicit approval request; **Reject document** requires a reason.
- Core reference, plate and validity fields retain their existing columns. Additional fields are saved as a document-specific `review_details` object.
- Ordinary accounts cannot write review metadata or approve their documents. The administrator RPC validates applicable field names and vehicle classes before writing.
- Existing audit triggers record the administrator, timestamp and changed field names. Verified birth dates update the profile only after an approved identity/license review.
- Rejection does not submit the draft edits as verified information.

## Verification

- `npm run test:db` — 125 local database checks, including metadata persistence, authorization, inappropriate fields, optional ID expiry, professional classification and audit records.
- `node --experimental-strip-types --test scripts/document-review.test.mjs` — 6 field-configuration and payload-isolation checks.
- Run Expo lint and TypeScript checks after changes.
- Live check: select each document type, open its evidence, verify the applicable form, approve or reject designated test records, reopen them and inspect the audit log. Browser UI behavior still needs this manual check.

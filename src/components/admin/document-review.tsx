import { useState } from "react";
import { Text, View } from "react-native";
import * as Linking from "expo-linking";
import { AsyncButton } from "@/components/camotes/api-ui";
import { Chip, Field, Heading } from "@/components/camotes/ui";
import { DateField } from "@/components/camotes/date-field";
import {
  DOCUMENT_REVIEW_FIELDS,
  REVIEW_VEHICLE_CLASSES,
  documentReviewPayload,
  isLicenseReview,
  reviewDraft,
} from "@/lib/document-review";
import { documentLabel } from "@/lib/verification-guide";
import { signedFile } from "@/lib/uploads";
import { isDateOnly } from "@/lib/date-only";
import { manilaDate, text, type Row } from "@/data/models";

export function DocumentReview({
  record,
  onSave,
  saving,
}: {
  record: Row;
  onSave: (path: string, body: Row) => Promise<void>;
  saving: boolean;
}) {
  const kind = text(record.document_type);
  const fields = DOCUMENT_REVIEW_FIELDS[kind];
  const [draft, setDraft] = useState(() => reviewDraft(record));
  const [reason, setReason] = useState(() => text(record.rejection_reason));
  const [classes, setClasses] = useState<string[]>(() =>
    Array.isArray(record.reviewed_vehicle_classes)
      ? record.reviewed_vehicle_classes.filter(
          (c): c is string =>
            typeof c === "string" && REVIEW_VEHICLE_CLASSES.includes(c),
        )
      : [],
  );
  const [professional, setProfessional] = useState(false);
  const today = manilaDate();
  const hasDetails = Object.prototype.hasOwnProperty.call(
    record,
    "review_details",
  );
  const invalidDates = fields?.some(
    (f) =>
      f.date &&
      ((!f.optional && !draft[f.key]) ||
        (!!draft[f.key] && !isDateOnly(draft[f.key]))),
  );
  const invalidRange =
    !!draft.issued_on &&
    !!draft.expires_on &&
    draft.issued_on > draft.expires_on;
  const expired = !!draft.expires_on && draft.expires_on < today;
  const futureDate =
    (!!draft.issued_on && draft.issued_on > today) ||
    (!!draft.verified_date_of_birth && draft.verified_date_of_birth > today);
  const blocked =
    !fields ||
    invalidDates ||
    invalidRange ||
    expired ||
    futureDate ||
    !hasDetails ||
    (isLicenseReview(kind) && !classes.length) ||
    (kind === "professional_license" && !professional);
  return (
    <View className="gap-4">
      <Heading
        title={documentLabel(kind)}
        sub="Review the uploaded evidence, then confirm your decision. Entering a value does not verify the document."
      />
      <View className="bg-mint rounded-2xl p-4">
        <Text className="text-sm font-semibold text-ink mb-3">
          Private evidence
        </Text>
        <AsyncButton
          secondary
          title="View private evidence"
          disabled={saving}
          onPress={async () =>
            Linking.openURL(
              await signedFile(
                "verification-documents",
                text(record.storage_path),
              ),
            )
          }
        />
      </View>
      <Heading
        title="Review selected record"
        sub="Record only information shown in the evidence or established by your verification policy. Optional fields can be left blank."
      />
      {!fields && (
        <Text className="text-sm text-ink">
          This document type has no review configuration. Approval is
          unavailable.
        </Text>
      )}
      {!hasDetails && (
        <Text accessibilityRole="alert" className="text-sm text-ink">
          Apply database migration 202610150004_document_review_fields.sql and
          refresh before approving this document. Its additional review fields
          must be saved with the decision.
        </Text>
      )}
      {fields?.map((f) =>
        f.date ? (
          <DateField
            key={f.key}
            label={`${f.label}${f.optional ? " (optional)" : " (required by platform)"}`}
            value={draft[f.key] || ""}
            onChangeText={(value) =>
              setDraft((old) => ({ ...old, [f.key]: value }))
            }
            optional={f.optional}
            maximumDate={f.key === "expires_on" ? undefined : today}
            initialDate={
              f.key === "verified_date_of_birth" ? "2000-01-01" : undefined
            }
            helperText={
              f.key === "expires_on" && !f.optional
                ? "Current verification rules require a validity end date for this document."
                : undefined
            }
          />
        ) : (
          <Field
            key={f.key}
            label={`${f.label} (if available)`}
            value={draft[f.key] || ""}
            onChangeText={(value) =>
              setDraft((old) => ({ ...old, [f.key]: value }))
            }
            multiline={f.key === "coverage_details"}
          />
        ),
      )}
      {isLicenseReview(kind) && (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-ink">
            Verified vehicle classes (required)
          </Text>
          <Text className="text-xs text-muted">
            Select only the classes allowed by the reviewed license.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {REVIEW_VEHICLE_CLASSES.map((c) => (
              <Chip
                key={c}
                title={c === "suv" ? "SUV" : c}
                selected={classes.includes(c)}
                onPress={() =>
                  setClasses((old) =>
                    old.includes(c) ? old.filter((v) => v !== c) : [...old, c],
                  )
                }
              />
            ))}
          </View>
        </View>
      )}
      {kind === "professional_license" && (
        <View className="gap-2">
          <Text className="text-xs text-muted">
            CamotesDrive requires a professional driver’s license for Driver
            mode. An unrelated professional credential does not qualify.
          </Text>
          <Chip
            title={
              professional
                ? "✓ Professional driver’s license checked"
                : "I verified this is a professional driver’s license"
            }
            selected={professional}
            onPress={() => setProfessional(!professional)}
          />
        </View>
      )}
      {(invalidRange || expired || futureDate || invalidDates) && (
        <Text accessibilityRole="alert" className="text-sm text-ink">
          Check the dates: required validity dates must be filled in, expiry
          cannot precede issue or be in the past, and birth / issue dates cannot
          be in the future.
        </Text>
      )}
      <Field
        label="Rejection reason (required only when rejecting)"
        value={reason}
        onChangeText={setReason}
        multiline
      />
      <AsyncButton
        title="Approve reviewed document"
        disabled={saving || !!blocked}
        onPress={() =>
          onSave(
            `/admin/documents/${text(record.id)}`,
            documentReviewPayload(kind, draft, classes, professional),
          )
        }
      />
      <AsyncButton
        secondary
        title="Reject document"
        disabled={saving || !reason.trim()}
        onPress={() =>
          onSave(`/admin/documents/${text(record.id)}`, {
            decision: "rejected",
            reason: reason.trim(),
          })
        }
      />
      <Text className="text-xs text-muted">
        Approval and rejection are recorded with your administrator identity and
        review time. Rejection does not save edits as verified information.
      </Text>
    </View>
  );
}

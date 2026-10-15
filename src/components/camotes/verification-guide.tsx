import { Text, View } from "react-native";
import { Badge, Card, Chip, Heading } from "./ui";
import {
  documentLabel,
  documentProgress,
  VERIFICATION_GOALS,
  type VerificationGoal,
} from "@/lib/verification-guide";
import { manilaDate, text, type Row } from "@/data/models";

export function VerificationGuide({
  goal,
  onGoal,
  documents,
  loading,
  error,
  vehicles,
  vehicle,
  onVehicle,
}: {
  goal: VerificationGoal;
  onGoal: (goal: VerificationGoal) => void;
  documents: Row[];
  loading: boolean;
  error: string;
  vehicles: Row[];
  vehicle: string;
  onVehicle: (id: string) => void;
}) {
  const selectedVehicle = vehicles.find((v) => v.id === vehicle);
  const checklist = (kinds: string[], vehicleId: string | null = null) =>
    kinds.map((kind) => {
      const status = error
        ? "Status unavailable"
        : loading
          ? "Checking…"
          : documentProgress(documents, kind, vehicleId, manilaDate());
      return (
        <View key={kind} className="py-3 border-b border-[#E6EAE2] gap-2">
          <Text className="text-sm font-semibold text-ink">
            {documentLabel(kind)}
          </Text>
          <Badge
            text={status}
            warm={status !== "Approved" && status !== "In review"}
          />
        </View>
      );
    });
  return (
    <Card>
      <Heading
        title="What do I need to upload?"
        sub="Choose what you want to do to see the standard document checklist."
      />
      <View className="flex-row flex-wrap gap-2 mb-4">
        {(Object.keys(VERIFICATION_GOALS) as VerificationGoal[]).map((key) => (
          <Chip
            key={key}
            title={VERIFICATION_GOALS[key].label}
            selected={goal === key}
            onPress={() => onGoal(key)}
          />
        ))}
      </View>
      <Text className="text-sm text-muted mb-2">
        {VERIFICATION_GOALS[goal].help}
      </Text>
      {checklist(VERIFICATION_GOALS[goal].documents)}
      {goal === "owner" && (
        <View className="mt-4">
          <Text className="text-sm font-semibold text-ink mb-2">
            Documents for each vehicle
          </Text>
          <Text className="text-xs text-muted mb-3">
            Select a vehicle to see its own checklist. Account documents cannot
            replace vehicle documents.
          </Text>
          <Text className="text-sm text-muted mb-3 leading-6">
            Every vehicle needs OR &amp; CR and CTPL insurance. Vehicles offered
            with a driver also need LTFRB authority and passenger insurance.
            Business-owned vehicles also need a business permit and DTI / SEC
            registration.
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {vehicles.map((v) => (
              <Chip
                key={text(v.id)}
                title={text(v.name)}
                selected={vehicle === v.id}
                onPress={() => onVehicle(text(v.id))}
              />
            ))}
          </View>
          {!selectedVehicle ? (
            <Text className="text-sm text-muted">
              Save a vehicle draft in Provider → Vehicles, then select it here
              to upload its documents.
            </Text>
          ) : (
            <>
              {checklist(
                selectedVehicle.service_type === "both"
                  ? [
                      "or_cr",
                      "ctpl_insurance",
                      "ltfrb_authority",
                      "passenger_insurance",
                    ]
                  : ["or_cr", "ctpl_insurance"],
                vehicle,
              )}
              {selectedVehicle.business_owned === true && (
                <View className="mt-3">
                  <Text className="text-sm font-semibold text-ink">
                    Also required for your business
                  </Text>
                  {checklist(["business_permit", "dti_sec_registration"])}
                </View>
              )}
            </>
          )}
        </View>
      )}
      <Text className="text-xs text-muted mt-4 leading-5">
        Use the upload form below for each document. A file is only sent for
        review after you tap “Submit for review”. All required documents need
        administrator approval; your trip dates and license classes are checked
        before booking. Administrators may request additional documents.
      </Text>
    </Card>
  );
}

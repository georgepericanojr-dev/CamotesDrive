import { useState } from "react";
import { Image, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Chip,
  Field,
  Heading,
  Row,
  Screen,
} from "@/components/camotes/ui";
import { dateLabel, money, vehicles } from "@/data/mock";
import { useDemo } from "@/state/demo";
export default function TripDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips, updateTrip, toast, mode } = useDemo();
  const t = trips.find((x) => x.id === id);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState(false);
  if (!t)
    return (
      <Screen title="Trip not found" back>
        <Button
          title="View all trips"
          onPress={() => router.replace("/trips")}
        />
      </Screen>
    );
  const v = vehicles.find((x) => x.id === t.vehicleId)!;
  const active = ![
    "Cancelled",
    "Completed",
    "Declined",
    "Expired",
    "No show",
  ].includes(t.status);
  const freeCancellation =
    Date.parse(`${t.start}T09:00:00+08:00`) -
      Date.parse("2026-10-15T09:00:00+08:00") >=
    48 * 3600000;
  const confirmed = [
    "Confirmed",
    "In progress",
    "En route",
    "Completed",
  ].includes(t.status);
  return (
    <Screen title="Your trip details" subtitle={t.id} back>
      <Image
        source={v.image}
        style={{
          height: 240,
          width: "100%",
          borderRadius: 24,
          marginBottom: 20,
        }}
      />
      <Card>
        <Badge text={t.status.toUpperCase()} />
        <View className="mt-4">
          <Heading title={v.name} />
        </View>
        <Row
          title="Island dates"
          detail={`${dateLabel(t.start)} — ${dateLabel(t.end)}`}
        />
        <Row title="Pickup & return" detail={`${t.pickup} · 9:00 AM`} />
        <Row
          title="Service"
          detail={t.driver ? "With verified driver" : "Self-drive"}
        />
        {t.authorizedDriver && (
          <Row
            title="Authorized additional driver"
            detail={`${t.authorizedDriver} · Demo verified`}
          />
        )}
        {t.driver && (
          <Row
            title="Driver / vehicle authority"
            detail="Ramon Cruz · DEMO 1028 · LTFRB DEMO-2026-01"
          />
        )}
        <Row
          title="Rental + service fee"
          detail={money(
            Math.round((v.price + (t.driver ? 1200 : 0)) * t.days * 1.05),
          )}
        />
        <Row
          title="Deposit"
          detail={`${money(v.deposit)} · ${t.status === "Completed" ? "Returned" : "Due at pickup"}`}
        />
        <Row title="Payment" detail={`${t.payment} · ${t.method}`} />
        <Text className="text-xs text-muted leading-5 mt-4">
          {confirmed
            ? "✓ Owner accepted. Your pickup details are ready."
            : "Waiting for owner approval. Response window: 24 hours. Availability will be checked again before confirmation."}
        </Text>
      </Card>
      <Card>
        <Heading title="Your local connection" />
        <Text className="font-semibold text-ocean">
          {v.owner} · Verified owner
        </Text>
        <Text className="text-xs text-muted mt-2 mb-4">
          {confirmed
            ? "+63 917 000 1028 · Demo contact"
            : "Contact details appear after confirmation."}
        </Text>
        <Button
          title="Message about this booking"
          secondary
          onPress={() =>
            router.push({ pathname: "/chat/[id]", params: { id: t.id } })
          }
        />
        {confirmed && (
          <View className="mt-3">
            <Button
              secondary
              title="Pickup directions"
              onPress={() =>
                toast(
                  `Demo directions: meet at ${t.pickup}, main entrance, 9:00 AM.`,
                )
              }
            />
          </View>
        )}
      </Card>
      {confirmed && t.payment === "Unpaid" && t.method !== "Cash on pickup" && (
        <Card>
          <Heading
            title="Submit your payment"
            sub="Use the sample payment details below. No money moves in the demo."
          />
          <Row title={`${t.method} account`} detail="DEMO · 0917 000 0000" />
          <View className="mt-4">
            <Field
              label="Payment reference number"
              value={reference}
              onChangeText={setReference}
            />
            <Button
              secondary
              title={
                proof
                  ? "✓ Sample proof attached"
                  : "Attach sample payment proof"
              }
              onPress={() => setProof(!proof)}
            />
          </View>
          <View className="mt-4">
            <Button
              title="Submit for verification"
              disabled={!reference.trim()}
              onPress={() => {
                updateTrip(t.id, {
                  payment: "Pending verification",
                  reference,
                });
                toast("Payment reference submitted for review.");
              }}
            />
          </View>
        </Card>
      )}
      {mode !== "Renter" && active && (
        <Card>
          <Heading
            title={mode === "Owner" ? "Manage this rental" : "Your next step"}
          />
          {t.status === "Pending owner" && mode === "Owner" && (
            <View className="gap-3">
              <Button
                title="Accept request (demo)"
                onPress={() =>
                  updateTrip(t.id, {
                    status: t.driver ? "Pending driver" : "Confirmed",
                  })
                }
              />
              <Button
                secondary
                title="Decline request"
                onPress={() => updateTrip(t.id, { status: "Declined" })}
              />
            </View>
          )}
          {t.status === "Pending driver" && mode === "Driver" && (
            <View className="gap-3">
              <Button
                title="Accept driver assignment"
                onPress={() => updateTrip(t.id, { status: "Confirmed" })}
              />
              <Button
                secondary
                title="Decline assignment"
                onPress={() => {
                  updateTrip(t.id, { status: "Declined" });
                  toast(
                    "Driver declined. Renter may rebook self-drive or choose another driver.",
                  );
                }}
              />
            </View>
          )}
          {confirmed && (
            <>
              <Field
                label="Condition notes"
                value={notes}
                onChangeText={setNotes}
                multiline
              />
              <Button
                secondary
                title={
                  photos
                    ? "✓ 3 sample condition photos attached"
                    : "Attach sample handover photos"
                }
                onPress={() => setPhotos(!photos)}
              />
              <View className="mt-3">
                <Button
                  title={
                    t.status === "Confirmed"
                      ? mode === "Driver"
                        ? "Mark en route"
                        : "Complete handover & start rental"
                      : t.status === "En route"
                        ? "Start trip"
                        : "Complete return & rental"
                  }
                  onPress={() => {
                    if (mode === "Owner" && !photos) {
                      toast("Attach condition photos before pickup or return.");
                      return;
                    }
                    updateTrip(t.id, {
                      status:
                        t.status === "Confirmed"
                          ? mode === "Driver"
                            ? "En route"
                            : "In progress"
                          : t.status === "En route"
                            ? "In progress"
                            : "Completed",
                    });
                    toast("Demo trip status updated.");
                  }}
                />
              </View>
            </>
          )}
          {t.payment === "Pending verification" && (
            <View className="mt-3">
              <Button
                title="Confirm payment receipt (demo)"
                onPress={() => updateTrip(t.id, { payment: "Paid" })}
              />
            </View>
          )}
        </Card>
      )}
      {t.status === "Completed" && !t.reviewed && mode === "Renter" && (
        <Card>
          <Heading title="How was your island ride?" />
          <View className="flex-row flex-wrap gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip
                key={n}
                title={`${n} ★`}
                selected={rating === n}
                onPress={() => setRating(n)}
              />
            ))}
          </View>
          <Field
            label="Share your experience"
            value={review}
            onChangeText={setReview}
            multiline
          />
          <Button
            title="Post review"
            onPress={() => {
              updateTrip(t.id, { reviewed: true });
              toast(`Your ${rating}-star review was saved in this demo.`);
            }}
          />
        </Card>
      )}
      {active && mode === "Renter" && (
        <Card>
          <Heading
            title="Plans changed?"
            sub="Free cancellation up to 48 hours before pickup. Later cancellations follow the owner’s policy."
          />
          {cancel ? (
            <View className="gap-3">
              <Text className="text-xs text-muted">
                {freeCancellation
                  ? "Cancel this booking? It qualifies for free cancellation."
                  : "Pickup is less than 48 hours away. A partial or no refund may apply under the cancellation policy."}
              </Text>
              <Button
                title="Confirm cancellation"
                onPress={() => {
                  updateTrip(t.id, { status: "Cancelled" });
                  toast("Trip cancelled. No demo payment was charged.");
                }}
              />
              <Button
                secondary
                title="Keep my trip"
                onPress={() => setCancel(false)}
              />
            </View>
          ) : (
            <Button
              title="Cancel booking"
              secondary
              onPress={() => setCancel(true)}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}

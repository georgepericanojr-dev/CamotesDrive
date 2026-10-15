import { useState } from "react";
import { Image, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { randomUUID } from "expo-crypto";
import {
  Badge,
  Card,
  Chip,
  Field,
  Heading,
  Row as DetailRow,
  Screen,
  Button,
} from "@/components/camotes/ui";
import {
  AsyncButton,
  ResourceState,
  SignInRequired,
} from "@/components/camotes/api-ui";
import { dateLabel, mapTrip, php, rows, text, type Row } from "@/data/models";
import { photoUrl } from "@/lib/api";
import { pickUpload, signedFile } from "@/lib/uploads";
import { useApp } from "@/state/app";
import { useResource } from "@/hooks/use-resource";
export default function TripDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { signedIn, session, mutate, toast } = useApp();
  const data = useResource<Row>(signedIn && id ? `/bookings/${id}` : null);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState("");
  const [method, setMethod] = useState("gcash");
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [paymentKey, setPaymentKey] = useState(() => randomUUID());
  const b = data.data;
  const t = b ? mapTrip(b, photoUrl) : null;
  const actor = session?.user.id;
  const renter = actor === b?.renter_id;
  const owner = actor === b?.owner_id;
  const driver = actor === b?.driver_id;
  const pending = ["pending_owner", "pending_driver"].includes(text(b?.status));
  const active = [
    ...["pending_owner", "pending_driver", "confirmed", "in_progress"],
  ].includes(text(b?.status));
  const action = async (verb: string, body: Row = {}) => {
    await mutate(`/bookings/${id}/${verb}`, body);
    data.refresh();
  };
  return (
    <Screen
      title="Your trip details"
      subtitle={b ? `Booking #${text(b.booking_number)}` : undefined}
      back
    >
      <SignInRequired />
      <ResourceState {...data} retry={data.refresh} />
      {b && t && (
        <>
          <Image
            source={t.vehicle.image}
            style={{
              height: 220,
              width: "100%",
              borderRadius: 24,
              marginBottom: 20,
            }}
          />
          <Card>
            <Badge text={t.status.toUpperCase()} />
            <View className="mt-4">
              <Heading title={t.vehicle.name} />
            </View>
            <DetailRow
              title="Dates"
              detail={`${dateLabel(t.start)} — ${dateLabel(t.end)}`}
            />
            <DetailRow title="Pickup & return" detail={t.pickup} />
            <DetailRow
              title="Service"
              detail={t.driver ? "With verified driver" : "Self-drive"}
            />
            <DetailRow
              title="Vehicle plate"
              detail={text(b.vehicle_plate_snapshot)}
            />
            {t.driver && (
              <>
                <DetailRow
                  title="Driver"
                  detail={text(b.driver_name_snapshot)}
                />
                <DetailRow
                  title="LTFRB case"
                  detail={text(b.ltfrb_case_snapshot)}
                />
                <DetailRow
                  title="Driver progress"
                  detail={text(b.driver_trip_status)}
                />
              </>
            )}
            <DetailRow title="Rental total" detail={php(b.total_centavos)} />
            <DetailRow
              title="Deposit · separate"
              detail={`${php(b.deposit_centavos)} · ${text(b.deposit_status)}`}
            />
            <DetailRow title="Payment" detail={t.payment} />
            {!!b.cancellation_reason && (
              <Text className="text-xs text-muted mt-4">
                {text(b.cancellation_reason)}
              </Text>
            )}
          </Card>
          <Card>
            <Heading title="Your local connection" />
            {rows(b.contacts).map((c) => (
              <View key={text(c.user_id)} className="mb-3">
                <DetailRow title={text(c.full_name)} detail={text(c.phone)} />
                {!!c.phone && (
                  <AsyncButton
                    secondary
                    title="Call"
                    onPress={async () =>
                      Linking.openURL(
                        `tel:${text(c.phone).replace(/[^+\d]/g, "")}`,
                      )
                    }
                  />
                )}
              </View>
            ))}
            {!rows(b.contacts).length && (
              <Text className="text-xs text-muted mb-4">
                Contact details become available after confirmation.
              </Text>
            )}
            <Button
              secondary
              title="Message about this booking"
              onPress={() =>
                router.push({ pathname: "/chat/[id]", params: { id } })
              }
            />
            <View className="mt-3">
              <AsyncButton
                secondary
                title="Open pickup in maps"
                onPress={async () =>
                  Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${t.pickup}, Camotes Islands, Cebu`)}`,
                  )
                }
              />
            </View>
          </Card>
          {(owner || driver) && active && (
            <Card>
              <Heading title="Manage this trip" />
              <View className="gap-3">
                {pending &&
                  ((owner && b.status === "pending_owner") ||
                    (driver && b.status === "pending_driver")) && (
                    <>
                      <AsyncButton
                        title="Accept request"
                        onPress={() => action("accept")}
                      />
                      <Field
                        label="Decline reason"
                        value={reason}
                        onChangeText={setReason}
                      />
                      <AsyncButton
                        secondary
                        title="Decline request"
                        disabled={!reason.trim()}
                        onPress={() => action("decline", { reason })}
                      />
                    </>
                  )}
                {driver && b.status === "confirmed" && (
                  <AsyncButton
                    title="Mark en route"
                    onPress={() => action("en_route")}
                  />
                )}
                {["confirmed", "in_progress"].includes(text(b.status)) && (
                  <>
                    {owner && (
                      <>
                        <Field
                          label="Condition notes"
                          value={notes}
                          onChangeText={setNotes}
                          multiline
                        />
                        <AsyncButton
                          secondary
                          title={`${photos.length} condition photos · upload another`}
                          onPress={async () => {
                            const path = await pickUpload("handover-photos");
                            if (path) setPhotos((p) => [...p, path]);
                          }}
                        />
                        <AsyncButton
                          secondary
                          title={`Record ${b.status === "confirmed" ? "pickup" : "return"} handover`}
                          disabled={!photos.length}
                          onPress={async () => {
                            await action("handovers", {
                              phase:
                                b.status === "confirmed" ? "pickup" : "return",
                              notes,
                              photo_paths: photos,
                            });
                            setPhotos([]);
                            toast("Condition handover recorded.");
                          }}
                        />
                      </>
                    )}
                    <AsyncButton
                      title={
                        b.status === "confirmed"
                          ? "Start trip"
                          : "Complete trip"
                      }
                      onPress={() =>
                        action(b.status === "confirmed" ? "start" : "complete")
                      }
                    />
                  </>
                )}
              </View>
            </Card>
          )}
          {(renter || owner) &&
            active &&
            !!b.owner_accepted_at &&
            b.payment_status !== "paid" && (
              <Card>
                <Heading
                  title="Record a manual payment"
                  sub="Pay your owner outside the app. Submit evidence for confirmation; no funds move here."
                />
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {["cash", "gcash", "maya", "bank_transfer"].map((m) => (
                    <Chip
                      key={m}
                      title={m.replaceAll("_", " ")}
                      selected={method === m}
                      onPress={() => setMethod(m)}
                    />
                  ))}
                </View>
                <Field
                  label="Payment reference (required for transfers)"
                  value={reference}
                  onChangeText={setReference}
                />
                <View className="gap-3">
                  <AsyncButton
                    secondary
                    title={
                      proof
                        ? "✓ Proof uploaded"
                        : "Upload payment proof (optional)"
                    }
                    onPress={async () => {
                      const p = await pickUpload("payment-proofs");
                      if (p) setProof(p);
                    }}
                  />
                  <AsyncButton
                    title="Submit payment for confirmation"
                    disabled={method !== "cash" && !reference.trim()}
                    onPress={async () => {
                      await mutate("/payments", {
                        booking_id: id,
                        method,
                        reference_number: reference || undefined,
                        proof_path: proof || undefined,
                        event_type: pending ? "advance" : "rental",
                        request_id: paymentKey,
                      });
                      setPaymentKey(randomUUID());
                      data.refresh();
                      toast(
                        "Payment submitted. Your owner must confirm receipt.",
                      );
                    }}
                  />
                </View>
              </Card>
            )}
          {(owner || renter) &&
            ["confirmed", "in_progress"].includes(text(b.status)) &&
            Number(b.deposit_centavos) > 0 &&
            b.deposit_status === "awaiting_collection" && (
              <Card>
                <Heading
                  title="Security deposit"
                  sub="Record the deposit paid outside the app; the owner confirms receipt."
                />
                <AsyncButton
                  secondary
                  title="Submit deposit payment"
                  onPress={async () => {
                    await mutate("/payments", {
                      booking_id: id,
                      event_type: "deposit_collection",
                      method: "cash",
                      request_id: paymentKey,
                    });
                    setPaymentKey(randomUUID());
                    data.refresh();
                  }}
                />
              </Card>
            )}
          {owner &&
            [
              "completed",
              "cancelled_by_renter",
              "cancelled_by_owner",
              "cancelled_by_driver",
            ].includes(text(b.status)) &&
            b.deposit_status === "held" && (
              <Card>
                <Heading
                  title="Return the security deposit"
                  sub="Return the funds outside the app first, then record the actual cash return."
                />
                <AsyncButton
                  secondary
                  title="Record completed cash deposit return"
                  onPress={async () => {
                    await mutate("/settlements", {
                      booking_id: id,
                      event_type: "deposit_return",
                      amount_centavos: Number(b.deposit_centavos),
                      method: "cash",
                      reason: "Deposit returned in cash after rental",
                      request_id: paymentKey,
                    });
                    setPaymentKey(randomUUID());
                    data.refresh();
                  }}
                />
              </Card>
            )}
          {rows(b.payments).length > 0 && (
            <Card>
              <Heading title="Payment history" />
              {rows(b.payments).map((p) => (
                <View key={text(p.id)} className="mb-5">
                  <DetailRow
                    title={`${text(p.event_type)} · ${php(p.amount_centavos)}`}
                    detail={text(p.status)}
                  />
                  {!!p.proof_path && (
                    <AsyncButton
                      secondary
                      title="Open private proof"
                      onPress={async () =>
                        Linking.openURL(
                          await signedFile(
                            "payment-proofs",
                            text(p.proof_path),
                          ),
                        )
                      }
                    />
                  )}
                  {owner && p.status === "pending_verification" && (
                    <View className="gap-2 mt-3">
                      <AsyncButton
                        title="Confirm receipt"
                        onPress={async () => {
                          await mutate(`/payments/${text(p.id)}/confirm`, {});
                          data.refresh();
                        }}
                      />
                      <AsyncButton
                        secondary
                        title="Reject reference"
                        onPress={async () => {
                          await mutate(`/payments/${text(p.id)}/reject`, {
                            reason: "Payment could not be verified",
                          });
                          data.refresh();
                        }}
                      />
                    </View>
                  )}
                </View>
              ))}
            </Card>
          )}
          {renter && b.status === "completed" && !b.reviewed && (
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
              <AsyncButton
                title="Submit review"
                onPress={async () => {
                  await mutate("/reviews", {
                    booking_id: id,
                    rating,
                    comment: review,
                    target_type: "vehicle",
                  });
                  data.refresh();
                  toast("Review published.");
                }}
              />
            </Card>
          )}
          {renter &&
            ["pending_owner", "pending_driver", "confirmed"].includes(
              text(b.status),
            ) && (
              <Card>
                <Heading
                  title="Plans changed?"
                  sub={`Free cancellation until ${text(b.cancellation_free_hours)} hours before pickup. Later refunds depend on the agreed policy.`}
                />
                <Field
                  label="Cancellation reason"
                  value={reason}
                  onChangeText={setReason}
                />
                <AsyncButton
                  secondary
                  title="Cancel this booking"
                  disabled={!reason.trim()}
                  onPress={() => action("cancel", { reason })}
                />
              </Card>
            )}
        </>
      )}
    </Screen>
  );
}

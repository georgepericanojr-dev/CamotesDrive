import { useState } from "react";
import { Text, View } from "react-native";
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
import { money, pickupPoints, vehicles } from "@/data/mock";
import { useDemo } from "@/state/demo";
export default function Booking() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const v = vehicles.find((x) => x.id === vehicleId) || vehicles[0];
  const { addTrip, toast, chauffeur, signedIn } = useDemo();
  const [step, setStep] = useState(0);
  const [start, setStart] = useState("2026-10-22");
  const [end, setEnd] = useState("2026-10-24");
  const [pickup, setPickup] = useState(pickupPoints[0]);
  const [custom, setCustom] = useState("");
  const [driver, setDriver] = useState(false);
  const [method, setMethod] = useState("Cash on pickup");
  const [agreed, setAgreed] = useState(false);
  const [authorized, setAuthorized] = useState("");
  const days = Math.ceil((Date.parse(end) - Date.parse(start)) / 86400000);
  const valid =
    /^2026-\d{2}-\d{2}$/.test(start) &&
    /^2026-\d{2}-\d{2}$/.test(end) &&
    Number.isFinite(days) &&
    days > 0 &&
    days <= 30 &&
    start >= "2026-10-15";
  const subtotal = v.price * (valid ? days : 0);
  const driverFee = driver ? 1200 * days : 0;
  const fee = Math.round((subtotal + driverFee) * 0.05);
  return (
    <Screen
      title="Make it an island date"
      subtitle={`${v.name} · ${money(v.price)} per 24 hours`}
      back
    >
      <View className="flex-row gap-2 mb-6">
        {["Your trip", "Payment", "Review"].map((x, i) => (
          <Chip
            key={x}
            title={`${i + 1}. ${x}`}
            selected={step === i}
            onPress={() => i < step && setStep(i)}
          />
        ))}
      </View>
      <Card>
        {step === 0 ? (
          <>
            <Heading title="The little details" />
            <Field
              label="Pickup date (YYYY-MM-DD) · 9:00 AM"
              value={start}
              onChangeText={setStart}
            />
            <Field
              label="Return date (YYYY-MM-DD) · 9:00 AM"
              value={end}
              onChangeText={setEnd}
            />
            <Text className="text-xs text-muted mb-3">
              Pickup and return location
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {[...pickupPoints, "Custom address"].map((p) => (
                <Chip
                  key={p}
                  title={p}
                  selected={pickup === p}
                  onPress={() => setPickup(p)}
                />
              ))}
            </View>
            {pickup === "Custom address" && (
              <Field
                label="Pickup address"
                value={custom}
                onChangeText={setCustom}
              />
            )}
            <Badge text="✓ LICENSE & ID VERIFIED · DEMO" />
            <View className="mt-4">
              <Field
                label="Additional authorized driver (optional; verified demo profile)"
                value={authorized}
                onChangeText={setAuthorized}
                placeholder="Full name"
              />
            </View>
            {chauffeur && (
              <View className="gap-3 mb-4">
                <Chip
                  title={
                    driver
                      ? "✓ With verified driver · ₱1,200/day"
                      : "Self-drive · add a verified driver"
                  }
                  selected={driver}
                  onPress={() => setDriver(!driver)}
                />
                {driver && (
                  <Text className="text-xs text-muted">
                    Ramon Cruz · Professional license verified{"\n"}Vehicle
                    plate: DEMO 1028 · LTFRB case: DEMO-2026-01{"\n"}Demo
                    accreditation active through Dec 31, 2026.
                  </Text>
                )}
              </View>
            )}
            <Button
              title="Continue to payment"
              disabled={
                !valid || (pickup === "Custom address" && !custom.trim())
              }
              onPress={() => setStep(1)}
            />
            {!valid && (
              <Text className="text-xs text-[#A45C38] mt-3">
                Choose valid future dates, 1–30 days apart.
              </Text>
            )}
          </>
        ) : step === 1 ? (
          <>
            <Heading
              title="Pay your way"
              sub="Payments happen outside the app. Your owner confirms receipt. No funds move in this demo."
            />
            <View className="gap-3 mb-5">
              {["Cash on pickup", "GCash", "Maya", "Bank transfer"].map((m) => (
                <Chip
                  key={m}
                  title={m}
                  selected={method === m}
                  onPress={() => setMethod(m)}
                />
              ))}
            </View>
            <Text className="text-xs text-muted leading-5 mb-5">
              You can submit a reference and sample proof from your trip after
              the owner accepts your request.
            </Text>
            <Button title="Review request" onPress={() => setStep(2)} />
          </>
        ) : (
          <>
            <Heading title="Your adventure, at a glance" />
            <Row title="Rental dates" detail={`${start} → ${end}`} />
            <Row
              title="Pickup & return"
              detail={pickup === "Custom address" ? custom : pickup}
            />
            <Row title={`Vehicle · ${days} days`} detail={money(subtotal)} />
            {driver && (
              <Row title="Verified driver" detail={money(driverFee)} />
            )}
            <Row title="Service fee · 5%" detail={money(fee)} />
            <Row
              title="Rental total"
              detail={money(subtotal + driverFee + fee)}
            />
            <Row
              title="Refundable deposit (separate)"
              detail={money(v.deposit)}
            />
            <Row title="Payment method" detail={method} />
            <Text className="text-xs text-muted leading-5 my-4">
              Owner approval is needed. This request does not reserve
              availability. Your refundable deposit is separate from the rental
              total.
            </Text>
            <Chip
              title={
                agreed
                  ? "✓ Rental terms & cancellation policy accepted"
                  : "Accept rental terms & cancellation policy"
              }
              selected={agreed}
              onPress={() => setAgreed(!agreed)}
            />
            <View className="mt-5">
              <Button
                title="Send booking request  ↗"
                disabled={!agreed}
                onPress={() => {
                  if (!signedIn) {
                    router.push("/auth");
                    return;
                  }
                  const id = `CD-${Date.now().toString().slice(-6)}`;
                  addTrip({
                    id,
                    vehicleId: v.id,
                    status: "Pending owner",
                    payment: "Unpaid",
                    start,
                    end,
                    days,
                    pickup: pickup === "Custom address" ? custom : pickup,
                    method,
                    driver,
                    authorizedDriver: authorized,
                  });
                  toast("Request sent. Your owner has 24 hours to respond.");
                  router.replace({ pathname: "/trip/[id]", params: { id } });
                }}
              />
            </View>
          </>
        )}
      </Card>
    </Screen>
  );
}

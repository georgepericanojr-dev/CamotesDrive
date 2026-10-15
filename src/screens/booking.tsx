import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  Badge,
  Card,
  Chip,
  Field,
  Heading,
  Row as DetailRow,
  Screen,
} from "@/components/camotes/ui";
import {
  AsyncButton,
  ResourceState,
  SignInRequired,
} from "@/components/camotes/api-ui";
import { api, photoUrl } from "@/lib/api";
import {
  asRow,
  manilaDate,
  mapVehicle,
  php,
  text,
  type Row,
} from "@/data/models";
import { useApp } from "@/state/app";
import { useResource } from "@/hooks/use-resource";
import { DateField } from "@/components/camotes/date-field";
import { addDateDays } from "@/lib/date-only";
import { rentalDatesFromParams, rentalEndForStart } from "@/lib/rental-dates";
export default function Booking() {
  const { vehicleId, startDate, endDate } = useLocalSearchParams<{
    vehicleId: string;
    startDate?: string;
    endDate?: string;
  }>();
  const { signedIn, chauffeur, mutate, toast } = useApp();
  const vehicle = useResource<Row[]>(
    vehicleId ? `/vehicles/${vehicleId}` : null,
  );
  const locations = useResource<Row[]>("/locations");
  const initialDates = rentalDatesFromParams(startDate, endDate, manilaDate(1));
  const [start, setStart] = useState(initialDates?.startDate || manilaDate(1));
  const [end, setEnd] = useState(initialDates?.endDate || manilaDate(3));
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [town, setTown] = useState("San Francisco");
  const [method, setMethod] = useState("cash");
  const [driver, setDriver] = useState("");
  const [authorized, setAuthorized] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [quote, setQuote] = useState<Row | null>(null);
  const [quotedInput, setQuotedInput] = useState("");
  const [step, setStep] = useState(0);
  const drivers = useResource<Row[]>(
    signedIn && chauffeur ? `/drivers?through=${end}` : null,
  );
  const v = vehicle.data?.[0] ? mapVehicle(vehicle.data[0], photoUrl) : null;
  const minimumDays = Math.max(1, Number(v?.raw.min_rental_days) || 1);
  const maximumDays = Math.max(
    minimumDays,
    Number(v?.raw.max_rental_days) || 365,
  );
  const firstReturnDate = addDateDays(start, minimumDays);
  const lastReturnDate = addDateDays(start, maximumDays);
  const validDates =
    !!rentalDatesFromParams(start, end, manilaDate(1)) &&
    end >= firstReturnDate &&
    end <= lastReturnDate;
  const input = {
    vehicle_id: vehicleId,
    starts_at: `${start}T09:00:00+08:00`,
    ends_at: `${end}T09:00:00+08:00`,
    pickup_location_id: location || undefined,
    return_location_id: location || undefined,
    pickup_address: location ? undefined : address,
    return_address: location ? undefined : address,
    pickup_town: location
      ? text(locations.data?.find((l) => l.id === location)?.town)
      : town,
    driver_id: driver || undefined,
    payment_method: method,
    authorized_driver_ids: authorized
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  };
  const fingerprint = JSON.stringify(input);
  const requestKey = useMemo(
    () => ({ fingerprint, id: randomUUID() }),
    [fingerprint],
  );
  return (
    <Screen
      title="Make it an island date"
      subtitle={v?.name || "Choose your rental details"}
      back
    >
      <SignInRequired />
      <ResourceState {...vehicle} retry={vehicle.refresh} />
      {v && signedIn && (
        <>
          <View className="flex-row flex-wrap gap-2 mb-5">
            {["Your trip", "Payment", "Review"].map((s, i) => (
              <Chip
                key={s}
                title={`${i + 1}. ${s}`}
                selected={step === i}
                onPress={() => i < step && setStep(i)}
              />
            ))}
          </View>
          <Card>
            {step === 0 ? (
              <>
                <Heading title="The little details" />
                <DateField
                  label="Pickup date · 9 AM"
                  value={start}
                  minimumDate={manilaDate(1)}
                  onChangeText={(value) => {
                    setStart(value);
                    setEnd((previous) =>
                      rentalEndForStart(
                        value,
                        previous,
                        minimumDays,
                        maximumDays,
                      ),
                    );
                  }}
                  helperText="Pickup and return times use Philippine time."
                />
                <DateField
                  label="Return date · 9 AM"
                  value={end}
                  onChangeText={setEnd}
                  minimumDate={firstReturnDate}
                  maximumDate={lastReturnDate}
                />
                {!validDates && (
                  <Text
                    accessibilityRole="alert"
                    className="text-sm text-ink mb-4"
                  >
                    Choose a future pickup and a return date {minimumDays}–
                    {maximumDays} days later.
                  </Text>
                )}
                <ResourceState {...locations} retry={locations.refresh} />
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {locations.data?.map((l) => (
                    <Chip
                      key={text(l.id)}
                      title={text(l.name)}
                      selected={location === l.id}
                      onPress={() => setLocation(text(l.id))}
                    />
                  ))}
                  <Chip
                    title="Custom address"
                    selected={!location}
                    onPress={() => setLocation("")}
                  />
                </View>
                {!location && (
                  <>
                    <Field
                      label="Pickup & return address"
                      value={address}
                      onChangeText={setAddress}
                    />
                    <View className="flex-row flex-wrap gap-2 mb-4">
                      {["San Francisco", "Poro", "Tudela", "Pilar"].map((t) => (
                        <Chip
                          key={t}
                          title={t}
                          selected={town === t}
                          onPress={() => setTown(t)}
                        />
                      ))}
                    </View>
                  </>
                )}
                <Field
                  label="Additional verified self-drive account IDs (optional, comma separated)"
                  value={authorized}
                  onChangeText={setAuthorized}
                />
                <Badge text="LICENSE, AGE & ID ARE CHECKED BY THE SERVER" />
                {chauffeur && v.raw.with_driver_eligible === true && (
                  <View className="mt-4 gap-2">
                    <Heading title="A local driver" />
                    <Chip
                      title="Self-drive"
                      selected={!driver}
                      onPress={() => setDriver("")}
                    />
                    <ResourceState {...drivers} retry={drivers.refresh} />
                    {drivers.data?.map((d) => (
                      <Chip
                        key={text(d.id)}
                        title={`${text(d.name)} · ${php(d.daily_fee_centavos)} / day`}
                        selected={driver === d.id}
                        onPress={() => {
                          setDriver(text(d.id));
                          setAuthorized("");
                        }}
                      />
                    ))}
                  </View>
                )}
                <View className="mt-5">
                  <AsyncButton
                    title="Continue to payment"
                    disabled={!validDates || (!location && !address.trim())}
                    onPress={async () => setStep(1)}
                  />
                </View>
              </>
            ) : step === 1 ? (
              <>
                <Heading
                  title="Pay your way"
                  sub="Payments happen directly with your owner. No online funds are collected here."
                />
                <View className="gap-3 mb-5">
                  {["cash", "gcash", "maya", "bank_transfer"].map((m) => (
                    <Chip
                      key={m}
                      title={
                        m === "cash" ? "Cash on pickup" : m.replaceAll("_", " ")
                      }
                      selected={method === m}
                      onPress={() => setMethod(m)}
                    />
                  ))}
                </View>
                <AsyncButton
                  title="Get server price & review"
                  onPress={async () => {
                    const price = await api<Row>("/bookings/quote", input);
                    setQuote(price);
                    setQuotedInput(fingerprint);
                    setStep(2);
                  }}
                />
              </>
            ) : (
              <>
                <Heading title="Your adventure, at a glance" />
                <DetailRow title="Dates" detail={`${start} → ${end}`} />
                <DetailRow
                  title="Vehicle rental"
                  detail={php(quote?.vehicle_centavos)}
                />
                <DetailRow
                  title="Driver fee"
                  detail={php(quote?.driver_centavos)}
                />
                <DetailRow
                  title="Service fee"
                  detail={php(quote?.service_fee_centavos)}
                />
                <DetailRow
                  title="Rental total"
                  detail={php(quote?.total_centavos)}
                />
                <DetailRow
                  title="Refundable deposit · separate"
                  detail={php(quote?.deposit_centavos)}
                />
                <Text className="text-xs text-muted my-4 leading-5">
                  This is a request, not a confirmation. The server checks
                  availability, verification, and all required provider
                  acceptances. Upload ID/license documents first if needed.
                </Text>
                <Chip
                  title={
                    agreed
                      ? "✓ Rental terms accepted"
                      : "Accept rental terms & cancellation policy"
                  }
                  selected={agreed}
                  onPress={() => setAgreed(!agreed)}
                />
                <View className="mt-5">
                  <AsyncButton
                    title="Send booking request"
                    disabled={!agreed || fingerprint !== quotedInput}
                    onPress={async () => {
                      const created = await mutate<Row>("/bookings", {
                        ...input,
                        request_id: requestKey.id,
                        accept_terms: agreed,
                        expected_total_centavos: quote?.total_centavos,
                      });
                      toast("Booking request sent.");
                      router.replace({
                        pathname: "/trip/[id]",
                        params: { id: text(asRow(created).id) },
                      });
                    }}
                  />
                </View>
              </>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

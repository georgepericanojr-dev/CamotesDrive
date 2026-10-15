import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Badge,
  Button,
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
import { manilaDate, number, php, rows, text, type Row } from "@/data/models";
import { useApp } from "@/state/app";
import { useResource } from "@/hooks/use-resource";
import { pickUpload } from "@/lib/uploads";
import { DateField } from "@/components/camotes/date-field";
export function Provider() {
  const { mode, name, signedIn, session, trips, driverProfile, mutate } =
    useApp();
  const stats = useResource<Row>(signedIn ? "/earnings" : null);
  return (
    <Screen
      title={`Good morning, ${name.split(" ")[0]}.`}
      subtitle="Your local business, connected to your account."
    >
      <SignInRequired />
      {signedIn && (
        <>
          <Badge text={`${mode.toUpperCase()} MODE`} />
          <ResourceState {...stats} retry={stats.refresh} />
          <View className="mt-5">
            <Card>
              <Heading title="Completed rental income" />
              <Text className="text-3xl font-semibold text-ocean">
                {php(
                  stats.data?.[
                    mode === "Owner"
                      ? "owner_gross_centavos"
                      : "driver_gross_centavos"
                  ],
                )}
              </Text>
              <Text className="text-xs text-muted mt-3">
                Gross income before refunds or payout adjustments.
              </Text>
            </Card>
          </View>
          {mode === "Driver" && (
            <Card>
              <Heading
                title={
                  driverProfile.available_for_hire
                    ? "Available for hire"
                    : "Taking a little break"
                }
              />
              <AsyncButton
                secondary
                title={
                  driverProfile.available_for_hire
                    ? "Turn availability off"
                    : "Turn availability on"
                }
                onPress={() =>
                  mutate("/driver-profile", {
                    available_for_hire: !driverProfile.available_for_hire,
                  })
                }
              />
              <DetailRow
                title="Daily driver fee"
                detail={php(driverProfile.daily_fee_centavos)}
                onPress={() => router.push("/availability")}
              />
            </Card>
          )}
          <Card>
            <Heading title="Your latest requests & trips" />
            {trips
              .filter((t) =>
                mode === "Owner"
                  ? t.raw.owner_id === session?.user.id
                  : t.raw.driver_id === session?.user.id,
              )
              .slice(0, 10)
              .map((t) => (
                <DetailRow
                  key={t.id}
                  title={t.vehicle.name}
                  detail={t.status}
                  onPress={() =>
                    router.push({
                      pathname: "/trip/[id]",
                      params: { id: t.id },
                    })
                  }
                />
              ))}
            {!trips.length && (
              <Text className="text-muted text-sm">
                Requests will appear here when a renter books your service.
              </Text>
            )}
          </Card>
          <View className="gap-3">
            <Button
              title={
                mode === "Owner"
                  ? "Manage your vehicles"
                  : "Manage availability"
              }
              onPress={() =>
                router.push(mode === "Owner" ? "/vehicles" : "/availability")
              }
            />
            <Button
              secondary
              title="Review your documents"
              onPress={() => router.push("/verification")}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
export function Vehicles() {
  const { signedIn, ownedVehicles, mutate } = useApp();
  return (
    <Screen
      title="Your keys to possibility"
      subtitle="Listing edits return to draft and require approval."
    >
      <SignInRequired />
      {signedIn && (
        <>
          <Button
            title="+ List a vehicle"
            onPress={() => router.push("/listing")}
          />
          <View className="mt-5">
            {ownedVehicles.map((v) => (
              <Card key={text(v.id)}>
                <Badge text={text(v.status).toUpperCase()} />
                <View className="mt-4">
                  <Heading
                    title={text(v.name)}
                    sub={`${php(v.daily_rate_centavos)} / day · ${text(v.plate_number)}`}
                  />
                </View>
                <DetailRow
                  title="Edit details & photos"
                  onPress={() =>
                    router.push({
                      pathname: "/listing",
                      params: { id: text(v.id) },
                    })
                  }
                />
                <DetailRow
                  title="Manage availability"
                  onPress={() =>
                    router.push({
                      pathname: "/availability",
                      params: { vehicleId: text(v.id) },
                    })
                  }
                />
                <View className="gap-3 mt-3">
                  <AsyncButton
                    secondary
                    title="Deactivate listing"
                    onPress={() =>
                      mutate(`/vehicles/${text(v.id)}/deactivate`, {})
                    }
                  />
                  <AsyncButton
                    secondary
                    title="Delete listing"
                    onPress={() => mutate(`/vehicles/${text(v.id)}/delete`, {})}
                  />
                </View>
              </Card>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
export function Listing() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { ownedVehicles, signedIn } = useApp();
  const existing = ownedVehicles.find((v) => v.id === id);
  return (
    <Screen
      title={id ? "Update your ride" : "Share a ride. Open a road."}
      subtitle="Save a draft, upload photos and documents, then submit for approval."
      back
    >
      <SignInRequired />
      {signedIn && (!id || existing) ? (
        <ListingForm key={id || "new"} initial={existing} />
      ) : signedIn ? (
        <Text className="text-muted">
          Loading the selected vehicle. Reopen it from Vehicles after your
          account finishes loading.
        </Text>
      ) : null}
    </Screen>
  );
}
function ListingForm({ initial }: { initial?: Row }) {
  const { mutate, toast } = useApp();
  const [vehicleId, setVehicleId] = useState(text(initial?.id));
  const [name, setName] = useState(text(initial?.name));
  const [make, setMake] = useState(text(initial?.make));
  const [model, setModel] = useState(text(initial?.model));
  const [year, setYear] = useState(
    text(initial?.year) || String(new Date().getFullYear()),
  );
  const [plate, setPlate] = useState(text(initial?.plate_number));
  const [rate, setRate] = useState(
    initial ? String(number(initial.daily_rate_centavos) / 100) : "",
  );
  const [deposit, setDeposit] = useState(
    initial ? String(number(initial.deposit_centavos) / 100) : "",
  );
  const [type, setType] = useState(text(initial?.vehicle_type) || "car");
  const [transmission, setTransmission] = useState(
    text(initial?.transmission) || "automatic",
  );
  const [town, setTown] = useState(
    text(initial?.pickup_town) || "San Francisco",
  );
  const [seats, setSeats] = useState(text(initial?.seats) || "5");
  const [rules, setRules] = useState(text(initial?.rules));
  const [fuel, setFuel] = useState(text(initial?.fuel_type) || "gasoline");
  const [service, setService] = useState(
    text(initial?.service_type) || "self_drive",
  );
  const [caseNumber, setCaseNumber] = useState(
    text(initial?.ltfrb_case_number),
  );
  const [authorityExpiry, setAuthorityExpiry] = useState(
    text(initial?.ltfrb_valid_until),
  );
  const [business, setBusiness] = useState(initial?.business_owned === true);
  const [advance, setAdvance] = useState(
    String(number(initial?.advance_required_centavos) / 100),
  );
  const [minimum, setMinimum] = useState(text(initial?.min_rental_days) || "1");
  const [maximum, setMaximum] = useState(
    text(initial?.max_rental_days) || "30",
  );
  const [age, setAge] = useState(text(initial?.minimum_renter_age) || "18");
  const [saved, setSaved] = useState(false);
  const [photoCount, setPhotoCount] = useState(
    Array.isArray(initial?.photos) ? initial.photos.length : 0,
  );
  return (
    <Card>
      <Field label="Listing name" value={name} onChangeText={setName} />
      <Field label="Make" value={make} onChangeText={setMake} />
      <Field label="Model" value={model} onChangeText={setModel} />
      <Field label="Year" value={year} onChangeText={setYear} />
      <Field label="Plate number" value={plate} onChangeText={setPlate} />
      <Field label="Seats" value={seats} onChangeText={setSeats} />
      <View className="flex-row flex-wrap gap-2 mb-4">
        {["car", "suv", "motorcycle", "van"].map((c) => (
          <Chip
            key={c}
            title={c}
            selected={type === c}
            onPress={() => setType(c)}
          />
        ))}
      </View>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {["automatic", "manual"].map((c) => (
          <Chip
            key={c}
            title={c}
            selected={transmission === c}
            onPress={() => setTransmission(c)}
          />
        ))}
      </View>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {["San Francisco", "Poro", "Tudela", "Pilar"].map((c) => (
          <Chip
            key={c}
            title={c}
            selected={town === c}
            onPress={() => setTown(c)}
          />
        ))}
      </View>
      <Field label="Daily price (PHP)" value={rate} onChangeText={setRate} />
      <Field
        label="Refundable deposit (PHP)"
        value={deposit}
        onChangeText={setDeposit}
      />
      <Field
        label="Required advance (PHP)"
        value={advance}
        onChangeText={setAdvance}
      />
      <Field
        label="Minimum rental days"
        value={minimum}
        onChangeText={setMinimum}
      />
      <Field
        label="Maximum rental days"
        value={maximum}
        onChangeText={setMaximum}
      />
      <Field label="Minimum renter age" value={age} onChangeText={setAge} />
      <View className="flex-row flex-wrap gap-2 mb-4">
        {["gasoline", "diesel", "electric", "hybrid"].map((f) => (
          <Chip
            key={f}
            title={f}
            selected={fuel === f}
            onPress={() => setFuel(f)}
          />
        ))}
      </View>
      <View className="gap-2 mb-4">
        <Chip
          title="Self-drive only"
          selected={service === "self_drive"}
          onPress={() => setService("self_drive")}
        />
        <Chip
          title="Self-drive and with driver (approval required)"
          selected={service === "both"}
          onPress={() => setService("both")}
        />
        <Chip
          title={business ? "✓ Business or fleet-owned" : "Individually owned"}
          selected={business}
          onPress={() => setBusiness(!business)}
        />
      </View>
      {service === "both" && (
        <>
          <Field
            label="LTFRB authority case number"
            value={caseNumber}
            onChangeText={setCaseNumber}
          />
          <DateField
            label="Authority valid until"
            value={authorityExpiry}
            onChangeText={setAuthorityExpiry}
            optional
          />
          <Text className="text-xs text-muted mb-4">
            Upload LTFRB authority and passenger insurance in Verification.
            Chauffeured service also requires active platform accreditation.
          </Text>
        </>
      )}
      <Field
        label="Rental rules"
        value={rules}
        onChangeText={setRules}
        multiline
      />
      <View className="gap-3">
        <AsyncButton
          title="Save draft to database"
          disabled={
            !name.trim() ||
            !make.trim() ||
            !model.trim() ||
            !plate.trim() ||
            Number(rate) <= 0
          }
          onPress={async () => {
            const v = await mutate<Row>("/vehicles", {
              id: vehicleId || undefined,
              name,
              make,
              model,
              year: Number(year),
              plate_number: plate,
              seats: Number(seats),
              vehicle_type: type,
              transmission,
              fuel_type: fuel,
              service_type: service,
              business_owned: business,
              ltfrb_case_number: caseNumber || undefined,
              ltfrb_valid_until: authorityExpiry || undefined,
              advance_required_centavos: Math.round(Number(advance || 0) * 100),
              min_rental_days: Number(minimum),
              max_rental_days: Number(maximum),
              minimum_renter_age: Number(age),
              pickup_town: town,
              daily_rate_centavos: Math.round(Number(rate) * 100),
              deposit_centavos: Math.round(Number(deposit || 0) * 100),
              rules,
            });
            setVehicleId(text(v.id));
            setSaved(true);
            toast(
              "Draft saved. Upload documents from Verification before approval.",
            );
          }}
        />
        <AsyncButton
          secondary
          title={`Upload vehicle photo (${photoCount} attached)`}
          disabled={!vehicleId || !saved}
          onPress={async () => {
            const path = await pickUpload("vehicle-photos", vehicleId);
            if (path) {
              await mutate(`/vehicles/${vehicleId}/photo`, { path });
              setPhotoCount((n) => n + 1);
            }
          }}
        />
        <Button
          secondary
          title="Upload OR/CR & insurance documents"
          onPress={() => router.push("/verification")}
        />
        <AsyncButton
          title="Submit listing for approval"
          disabled={!saved || !photoCount}
          onPress={async () => {
            await mutate(`/vehicles/${vehicleId}/submit`, {});
            toast("Listing submitted for approval.");
            router.replace("/vehicles");
          }}
        />
      </View>
    </Card>
  );
}
export function Availability() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const { signedIn, session, mode, driverProfile, mutate, toast } = useApp();
  const source = useResource<Row[]>(
    signedIn
      ? `/availability${vehicleId ? `?vehicle_id=${vehicleId}` : ""}`
      : null,
  );
  const [month, setMonth] = useState(() => manilaDate().slice(0, 7));
  // Keep unsaved changes when browsing another month or another vehicle.
  const [drafts, setDrafts] = useState<
    Record<string, { days: string[]; dirty: boolean }>
  >({});
  const [fee, setFee] = useState("");
  const [areas, setAreas] = useState("");
  const [languages, setLanguages] = useState("");
  const [reason, setReason] = useState("Unavailable");
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5)) - 1;
  const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const monthLabel = new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString(
    "en-PH",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  const loaded = rows(source.data)
    .map((b) =>
      new Date(text(b.starts_at)).toLocaleDateString("en-CA", {
        timeZone: "Asia/Manila",
      }),
    )
    .filter((day) => day.slice(0, 7) === month);
  const draftKey = `${session?.user.id}:${vehicleId || "driver"}:${month}`;
  const draft = drafts[draftKey];
  const blocked = draft?.days || loaded;
  const ready = !source.loading && !source.error && source.data !== null;
  const unsavedMonths = Object.keys(drafts).filter(
    (key) =>
      key.startsWith(`${session?.user.id}:${vehicleId || "driver"}:`) &&
      drafts[key].dirty,
  ).length;
  const moveMonth = (offset: number) => {
    setMonth(
      new Date(Date.UTC(year, monthIndex + offset, 1))
        .toISOString()
        .slice(0, 7),
    );
  };
  return (
    <Screen
      title="Make room for island days"
      subtitle="Choose a month, then select the dates you are unavailable."
      back
    >
      <SignInRequired />
      <ResourceState {...source} retry={source.refresh} />
      {signedIn && (
        <Card>
          <DateField
            label="Choose availability month"
            value={`${month}-01`}
            onChangeText={(day) => setMonth(day.slice(0, 7))}
            helperText="Choose any day to open its month in the calendar below."
          />
          <View className="flex-row items-center gap-3 mb-5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous availability month"
              className="bg-mint rounded-xl px-4 py-3"
              onPress={() => moveMonth(-1)}
            >
              <Text className="text-ocean">‹</Text>
            </Pressable>
            <Text className="text-ink font-semibold flex-1 text-center">
              {monthLabel}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next availability month"
              className="bg-mint rounded-xl px-4 py-3"
              onPress={() => moveMonth(1)}
            >
              <Text className="text-ocean">›</Text>
            </Pressable>
          </View>
          {unsavedMonths > 0 && (
            <Text className="text-muted text-xs mb-4">
              {unsavedMonths}{" "}
              {unsavedMonths === 1 ? "month has" : "months have"} unsaved
              changes. Save each month when ready; browsing keeps your
              selections.
            </Text>
          )}
          <View className="flex-row mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <Text
                key={day}
                className="text-xs text-muted text-center"
                style={{ width: "14.2857%" }}
              >
                {day}
              </Text>
            ))}
          </View>
          <View className="flex-row flex-wrap mb-5">
            {Array.from({ length: firstWeekday }, (_, i) => (
              <View
                key={`empty-${i}`}
                style={{ width: "14.2857%", padding: 3 }}
              />
            ))}
            {Array.from(
              { length: count },
              (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
            ).map((d) => (
              <View key={d} style={{ width: "14.2857%", padding: 3 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${d}${blocked.includes(d) ? ", unavailable" : ""}`}
                  accessibilityState={{
                    selected: blocked.includes(d),
                    disabled: !ready,
                  }}
                  disabled={!ready}
                  onPress={() =>
                    setDrafts((current) => ({
                      ...current,
                      [draftKey]: {
                        days: blocked.includes(d)
                          ? blocked.filter((x) => x !== d)
                          : [...blocked, d].sort(),
                        dirty: true,
                      },
                    }))
                  }
                  className={`rounded-xl py-4 items-center ${blocked.includes(d) ? "bg-ocean" : "bg-mint"}`}
                >
                  <Text
                    className={blocked.includes(d) ? "text-white" : "text-ink"}
                  >
                    {Number(d.slice(-2))}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Field label="Block reason" value={reason} onChangeText={setReason} />
          <AsyncButton
            title="Save unavailable dates"
            disabled={!ready || (mode === "Owner" && !vehicleId)}
            onPress={async () => {
              await mutate("/availability", {
                vehicle_id: vehicleId,
                month: `${month}-01`,
                days: blocked,
                reason,
              });
              setDrafts((current) => ({
                ...current,
                [draftKey]: {
                  days: current[draftKey]?.days || blocked,
                  // Changes made while saving still need another save.
                  dirty:
                    !!current[draftKey] && current[draftKey].days !== blocked,
                },
              }));
              source.refresh();
              toast(`Availability saved for ${monthLabel}.`);
            }}
          />
          {mode === "Driver" && (
            <View className="mt-6">
              <Field
                label={`Daily fee (PHP), current ${php(driverProfile.daily_fee_centavos)}`}
                value={fee}
                onChangeText={setFee}
              />
              <Field
                label="Service areas (comma separated)"
                value={areas}
                onChangeText={setAreas}
              />
              <Field
                label="Languages (comma separated)"
                value={languages}
                onChangeText={setLanguages}
              />
              <AsyncButton
                secondary
                title="Save driver preferences"
                onPress={() =>
                  mutate("/driver-profile", {
                    daily_fee_centavos: fee
                      ? Math.round(Number(fee) * 100)
                      : undefined,
                    service_areas: areas
                      ? areas.split(",").map((x) => x.trim())
                      : undefined,
                    languages: languages
                      ? languages.split(",").map((x) => x.trim())
                      : undefined,
                  })
                }
              />
            </View>
          )}
        </Card>
      )}
    </Screen>
  );
}
export function Earnings() {
  const { signedIn, mode } = useApp();
  const data = useResource<Row>(signedIn ? "/earnings" : null);
  return (
    <Screen
      title="Good roads. Growing possibilities."
      subtitle="Real completed rentals and manually recorded payouts."
    >
      <SignInRequired />
      <ResourceState {...data} retry={data.refresh} />
      {data.data && (
        <>
          <View className="bg-ocean rounded-3xl p-8 mb-5">
            <Text className="text-white/80 text-xs">
              GROSS COMPLETED RENTAL INCOME
            </Text>
            <Text className="text-white text-4xl font-semibold mt-3">
              {php(
                data.data[
                  mode === "Owner"
                    ? "owner_gross_centavos"
                    : "driver_gross_centavos"
                ],
              )}
            </Text>
            <Text className="text-white/80 text-xs mt-3">
              Before refunds or payout adjustments.
            </Text>
          </View>
          <Card>
            <Heading title="Recorded payouts" />
            {rows(data.data.payouts).map((p) => (
              <DetailRow
                key={text(p.id)}
                title={`${php(p.amount_centavos)} · ${text(p.method)}`}
                detail={text(p.status)}
              />
            ))}
            {!rows(data.data.payouts).length && (
              <Text className="text-muted text-sm">
                No payouts recorded yet.
              </Text>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

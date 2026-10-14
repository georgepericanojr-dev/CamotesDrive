import { useState } from "react";
import { Image, Text, View, Switch, Pressable } from "react-native";
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
export function Provider() {
  const { mode, name, toast, trips } = useDemo();
  const [available, setAvailable] = useState(true);
  const [request, setRequest] = useState("Pending");
  return (
    <Screen
      title={`Good morning, ${name.split(" ")[0]}.`}
      subtitle={
        mode === "Driver"
          ? "A new island day. A new adventure to guide."
          : "Your local business, at a glance."
      }
    >
      <Badge text={`${mode.toUpperCase()} MODE · VERIFIED DEMO ROLE`} />
      <View className="flex-row flex-wrap gap-4 my-6">
        {[
          [money(mode === "Owner" ? 24800 : 9600), "October earnings"],
          ["12", mode === "Owner" ? "Rentals this month" : "Trips this month"],
          ["4.9 ★", "Your rating"],
        ].map(([value, label]) => (
          <View
            key={label}
            className="flex-1 min-w-[130px] bg-white border border-[#E3E7DD] p-6 rounded-3xl"
          >
            <Text className="text-2xl font-bold text-ocean">{value}</Text>
            <Text className="text-xs text-muted mt-2">{label}</Text>
          </View>
        ))}
      </View>
      {mode === "Driver" && (
        <Card>
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-lg font-semibold text-ink">
                {available ? "Available for hire" : "Taking a little break"}
              </Text>
              <Text className="text-xs text-muted mt-2">
                San Francisco · Poro · English / Cebuano
              </Text>
            </View>
            <Switch
              accessibilityLabel="Available for hire"
              value={available}
              onValueChange={setAvailable}
              trackColor={{ true: "#164E43" }}
            />
          </View>
          <Row
            title="Your daily driver fee"
            detail="₱1,200 / day"
            onPress={() => router.push("/availability")}
          />
        </Card>
      )}
      <Card>
        <Heading
          title={
            mode === "Owner"
              ? "A new rental request"
              : "A new assignment request"
          }
          sub="Jamie Rivera · Oct 25–27 · Consuelo Port"
        />
        <Badge
          text={
            request === "Pending"
              ? "REPLY WITHIN 24 HOURS"
              : request.toUpperCase()
          }
          warm={request === "Pending"}
        />
        <Text className="text-lg font-semibold text-ink mt-4">
          Toyota Fortuner · 2 days
        </Text>
        <Text className="text-xs text-muted my-4">
          {mode === "Driver"
            ? "Demo assignment · approved LTFRB authority and professional license."
            : "Self-drive · Renter’s license and ID verified."}
        </Text>
        {request === "Pending" && (
          <View className="gap-3">
            <Button
              title="Accept request"
              onPress={() => {
                setRequest("Accepted");
                toast("Request accepted in demo state.");
              }}
            />
            <Button
              secondary
              title="Decline request"
              onPress={() => setRequest("Declined")}
            />
          </View>
        )}
      </Card>
      <Card>
        <Heading title="Next on your calendar" />
        {trips
          .filter((t) => t.status === "Confirmed")
          .map((t) => (
            <Row
              key={t.id}
              title={`${vehicles.find((v) => v.id === t.vehicleId)?.name} · ${dateLabel(t.start)}`}
              detail={t.pickup}
              onPress={() =>
                router.push({ pathname: "/trip/[id]", params: { id: t.id } })
              }
            />
          ))}
        <Row
          title="Manage availability"
          detail="October 2026"
          onPress={() => router.push("/availability")}
        />
      </Card>
      <Card>
        <Heading title="Keep your documents road-ready" />
        <Row
          title="Professional license / vehicle OR-CR"
          detail="Approved"
          onPress={() => router.push("/verification")}
        />
        <Row
          title="Insurance renewal"
          detail="Due in 30 days"
          onPress={() => router.push("/verification")}
        />
      </Card>
      <Button
        title={
          mode === "Owner" ? "Manage your vehicles" : "View your assigned trips"
        }
        onPress={() => router.push(mode === "Owner" ? "/vehicles" : "/trips")}
      />
    </Screen>
  );
}
export function Vehicles() {
  const { toast, submittedListings } = useDemo();
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [deleted, setDeleted] = useState<string[]>([]);
  return (
    <Screen
      title="Your keys to possibility"
      subtitle="Manage listings, prices, and availability."
    >
      <View className="mb-6">
        <Button
          title="+ List a vehicle"
          onPress={() => router.push("/listing")}
        />
      </View>
      {submittedListings.map((listing, i) => (
        <Card key={`pending-${i}`}>
          <Heading
            title={listing.name}
            sub={`${listing.plate} · ${money(Number(listing.rate))} / day`}
          />
          <Badge text="PENDING ADMIN APPROVAL" />
        </Card>
      ))}
      {vehicles
        .filter((v) => !deleted.includes(v.id))
        .map((v) => (
          <Card key={v.id}>
            <View className="flex-row gap-4 items-center mb-4">
              <Image
                source={v.image}
                style={{ width: 80, height: 80, borderRadius: 15 }}
              />
              <View className="flex-1">
                <Text className="text-lg font-semibold text-ink">{v.name}</Text>
                <Text className="text-xs text-muted mt-2">
                  {money(v.price)} / day · Self-drive
                </Text>
                <View className="mt-2">
                  <Badge text={statuses[v.id] || "APPROVED · ACTIVE"} />
                </View>
              </View>
            </View>
            <Row
              title="Edit details & pricing"
              onPress={() =>
                router.push({ pathname: "/listing", params: { id: v.id } })
              }
            />
            <Row
              title="Availability & maintenance"
              onPress={() => router.push("/availability")}
            />
            <Row
              title={
                statuses[v.id] === "INACTIVE"
                  ? "Reactivate listing"
                  : "Deactivate listing"
              }
              onPress={() =>
                setStatuses((s) => ({
                  ...s,
                  [v.id]:
                    s[v.id] === "INACTIVE" ? "APPROVED · ACTIVE" : "INACTIVE",
                }))
              }
            />
            <Row
              title="Delete demo listing"
              onPress={() => {
                setDeleted((d) => [...d, v.id]);
                toast("Listing removed from this demo view.");
              }}
            />
          </Card>
        ))}
    </Screen>
  );
}
export function Listing() {
  const {
    toast,
    listingDraft,
    setListingDraft,
    submittedListings,
    setSubmittedListings,
  } = useDemo();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = vehicles.find((v) => v.id === id);
  const saved = !id ? listingDraft : null;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(editing?.name || saved?.name || "");
  const [plate, setPlate] = useState(
    saved?.plate || (editing ? "DEMO 1028" : ""),
  );
  const [rate, setRate] = useState(
    String(editing?.price || saved?.rate || "1500"),
  );
  const [deposit, setDeposit] = useState(
    String(editing?.deposit || saved?.deposit || "3000"),
  );
  const [category, setCategory] = useState(
    editing?.category || saved?.category || "Cars",
  );
  const [photos, setPhotos] = useState(false);
  const [docs, setDocs] = useState(false);
  const [rules, setRules] = useState(
    "Same fuel level on return. Camotes Islands only.",
  );
  const [submitted, setSubmitted] = useState(false);
  return (
    <Screen
      title="Share a ride. Open a road."
      subtitle="New and edited listings require admin approval."
      back
    >
      <View className="flex-row flex-wrap gap-2 mb-6">
        {["Details", "Photos", "Pricing", "Rules", "Review"].map((s, i) => (
          <Chip
            key={s}
            title={`${i + 1}. ${s}`}
            selected={step === i}
            onPress={() => i < step && setStep(i)}
          />
        ))}
      </View>
      <Card>
        {submitted ? (
          <>
            <Badge text="PENDING ADMIN APPROVAL" />
            <View className="mt-4">
              <Heading
                title="Your listing is on its way"
                sub={`${name} was submitted in this demo. It will not appear in public search until reviewed.`}
              />
            </View>
            <Button
              title="Back to your vehicles"
              onPress={() => router.replace("/vehicles")}
            />
          </>
        ) : (
          <>
            {step === 0 && (
              <>
                <Field
                  label="Vehicle make & model"
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Toyota Vios 2024"
                />
                <Field
                  label="Plate number"
                  value={plate}
                  onChangeText={setPlate}
                />
                <View className="flex-row flex-wrap gap-2 mb-5">
                  {["Cars", "SUVs", "Motorcycles", "Vans"].map((c) => (
                    <Chip
                      key={c}
                      title={c}
                      selected={category === c}
                      onPress={() => setCategory(c)}
                    />
                  ))}
                </View>
                <Badge text="SELF-DRIVE ONLY · CHAUFFEUR SERVICE DISABLED" />
              </>
            )}
            {step === 1 && (
              <>
                <Heading
                  title="Show off your ride"
                  sub="Front, side, and interior photos help renters choose with confidence."
                />
                <Button
                  secondary
                  title={
                    photos
                      ? "✓ 3 sample photos attached"
                      : "Attach sample vehicle photos"
                  }
                  onPress={() => setPhotos(!photos)}
                />
                <View className="mt-4">
                  <Button
                    secondary
                    title={
                      docs
                        ? "✓ OR/CR & insurance samples attached"
                        : "Attach sample OR/CR & CTPL insurance"
                    }
                    onPress={() => setDocs(!docs)}
                  />
                </View>
              </>
            )}
            {step === 2 && (
              <>
                <Field
                  label="Daily rental rate (PHP)"
                  value={rate}
                  onChangeText={setRate}
                />
                <Field
                  label="Refundable security deposit (PHP)"
                  value={deposit}
                  onChangeText={setDeposit}
                />
                <Row title="Minimum / maximum rental" detail="1 / 30 days" />
                <Row
                  title="Pickup points"
                  detail="Consuelo Port, Santiago Bay"
                />
              </>
            )}
            {step === 3 && (
              <Field
                label="Fuel policy, area limits & rental rules"
                value={rules}
                onChangeText={setRules}
                multiline
              />
            )}
            {step === 4 && (
              <>
                <Heading
                  title={name}
                  sub={`${plate} · ${category} · Self-drive`}
                />
                <Row title="Daily rate" detail={money(Number(rate))} />
                <Row title="Deposit" detail={money(Number(deposit))} />
                <Row title="Documents & photos" detail="Samples attached" />
                <Text className="text-xs text-muted my-4">{rules}</Text>
                <Button
                  title="Submit listing for approval"
                  onPress={() => {
                    setSubmittedListings([
                      ...submittedListings,
                      { name, plate, rate, deposit, category },
                    ]);
                    setListingDraft(null);
                    setSubmitted(true);
                  }}
                />
              </>
            )}
            {step < 4 && (
              <View className="gap-3 mt-5">
                <Button
                  title="Continue  ↗"
                  disabled={
                    (step === 0 && (!name.trim() || !plate.trim())) ||
                    (step === 1 && (!photos || !docs)) ||
                    (step === 2 &&
                      (!Number.isFinite(Number(rate)) ||
                        Number(rate) <= 0 ||
                        !Number.isFinite(Number(deposit)) ||
                        Number(deposit) < 0))
                  }
                  onPress={() => setStep((s) => s + 1)}
                />
                <Button
                  title="Save draft (this session)"
                  secondary
                  onPress={() => {
                    setListingDraft({ name, plate, rate, deposit, category });
                    toast("Draft saved. Reopen List a vehicle to continue.");
                  }}
                />
              </View>
            )}
          </>
        )}
      </Card>
    </Screen>
  );
}
export function Availability() {
  const { mode, toast } = useDemo();
  const [blocked, setBlocked] = useState<number[]>([18, 19, 28]);
  const [fee, setFee] = useState("1200");
  const [reason, setReason] = useState("Personal / maintenance");
  return (
    <Screen
      title="Make room for island days"
      subtitle="October 2026 · Tap a date to block or unblock it."
      back
    >
      <Card>
        <Heading title="October 2026" />
        <View className="flex-row mb-3">
          {["S", "M", "T", "W", "T", "F", "S"].map((x, i) => (
            <Text
              key={i}
              className="text-center text-muted text-xs"
              style={{ width: "14.28%" }}
            >
              {x}
            </Text>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {Array.from({ length: 35 }, (_, i) => i - 3).map((n, i) => (
            <View key={i} style={{ width: "14.28%", padding: 3 }}>
              {n > 0 && n <= 31 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`October ${n}${blocked.includes(n) ? ", blocked" : ", available"}`}
                  onPress={() =>
                    setBlocked((b) =>
                      b.includes(n) ? b.filter((x) => x !== n) : [...b, n],
                    )
                  }
                  className={`rounded-xl py-4 items-center ${blocked.includes(n) ? "bg-ocean" : "bg-sand"}`}
                >
                  <Text
                    className={`text-sm ${blocked.includes(n) ? "text-white" : "text-ink"}`}
                  >
                    {n}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
        <Text className="text-xs text-muted my-5">
          Dark green = unavailable · Cream = available
        </Text>
        <Field label="Block reason" value={reason} onChangeText={setReason} />
        {mode === "Driver" && (
          <>
            <Field
              label="Daily driver fee (PHP)"
              value={fee}
              onChangeText={setFee}
            />
            <Row title="Service areas" detail="San Francisco · Poro" />
            <Row title="Languages" detail="English · Cebuano" />
          </>
        )}
        <Button
          title="Save availability"
          onPress={() =>
            toast(`${blocked.length} dates blocked in this demo calendar.`)
          }
        />
      </Card>
    </Screen>
  );
}
export function Earnings() {
  const { mode } = useDemo();
  return (
    <Screen
      title="Good roads. Growing possibilities."
      subtitle="October 2026 · Earnings and manual payouts."
    >
      <View className="bg-ocean rounded-3xl p-8 mb-6">
        <Text className="text-white/70 text-xs">YOUR OCTOBER EARNINGS</Text>
        <Text className="text-4xl text-white font-semibold mt-3">
          {money(mode === "Owner" ? 24800 : 9600)}
        </Text>
        <Text className="text-[#B7CFB9] text-xs mt-3">
          ↑ 18% from last month · 12 completed rentals
        </Text>
      </View>
      <Card>
        <Heading title="Payout overview" />
        <Row title="Available balance" detail="₱8,400" />
        <Row title="Pending owner/admin confirmation" detail="₱2,800" />
        <Row title="Payout method" detail="GCash · •••• 1028" />
        <Text className="text-xs text-muted mt-4 leading-5">
          Payouts are recorded manually. Automated transfers are not available
          in the MVP.
        </Text>
      </Card>
      <Card>
        <Heading title="Recent activity" />
        {[
          ["Oct 14 · Toyota Fortuner", "+ ₱5,320"],
          ["Oct 12 · Honda Click", "+ ₱855"],
          ["Oct 10 · Manual payout", "− ₱10,000"],
          ["Oct 08 · Toyota Vios", "+ ₱2,850"],
        ].map(([t, d]) => (
          <Row key={t} title={t} detail={d} />
        ))}
      </Card>
    </Screen>
  );
}

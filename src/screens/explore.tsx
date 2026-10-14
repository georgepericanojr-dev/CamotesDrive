import { useState } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Chip,
  Heading,
  Icon,
  Screen,
  VehicleCard,
} from "@/components/camotes/ui";
import { beach, vehicles } from "@/data/mock";
import { useDemo } from "@/state/demo";
export default function Explore() {
  const { width } = useWindowDimensions();
  const desktop = width > 1150;
  const { name } = useDemo();
  const [category, setCategory] = useState("All vehicles");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(false);
  const [area, setArea] = useState("Anywhere");
  const [budget, setBudget] = useState("Any price");
  const [transmission, setTransmission] = useState("Any");
  const [seats, setSeats] = useState("Any seats");
  const results = vehicles.filter(
    (v) =>
      (category === "All vehicles" || category === v.category) &&
      `${v.name} ${v.area}`.toLowerCase().includes(search.toLowerCase()) &&
      (area === "Anywhere" || v.area === area) &&
      (budget === "Any price" || v.price <= 1500) &&
      (transmission === "Any" || v.transmission === transmission) &&
      (seats === "Any seats" || v.seats >= 7),
  );
  return (
    <Screen>
      <View className="flex-row justify-between items-center mb-7">
        <View>
          <Text className="text-muted text-sm mb-2">
            A little adventure awaits, {name.split(" ")[0]} ☀
          </Text>
          <Text className="text-[28px] font-semibold text-ink tracking-tight">
            Where will the island take you?
          </Text>
        </View>
        {desktop && <Badge text="SLOW DAYS. GREAT DRIVES." />}
      </View>
      <ImageBackground
        source={beach}
        resizeMode="cover"
        imageStyle={{ borderRadius: 24 }}
        style={{
          minHeight: desktop ? 290 : 310,
          overflow: "hidden",
          borderRadius: 24,
          marginBottom: 24,
        }}
      >
        <View className="absolute inset-0 bg-[#12392F]/55" />
        <View className={`${desktop ? "p-10" : "p-7"} max-w-xl`}>
          <View className="self-start rounded-full border border-white/40 bg-white/10 px-3 py-2 mb-5">
            <Text className="text-[9px] tracking-[2px] text-white">
              YOUR CAMOTES ADVENTURE, YOUR WAY
            </Text>
          </View>
          <Text
            className={`${desktop ? "text-[43px]" : "text-[35px]"} text-white font-semibold leading-tight tracking-tight`}
          >
            Less planning.{"\n"}More{" "}
            <Text className="text-[#F0C49A]">island living.</Text>
          </Text>
          <Text className="text-white/90 text-sm mt-4 leading-6 max-w-sm">
            Find your perfect ride and discover the hidden{"\n"}corners of
            Camotes. Freedom comes with the keys.
          </Text>
          <View className="flex-row items-center gap-4 mt-6">
            <View className="flex-row">
              <Text className="text-[#F2C492] text-xs">★★★★★</Text>
            </View>
            <Text className="text-white/90 text-[11px]">
              Trusted by 200+ island explorers
            </Text>
          </View>
        </View>
      </ImageBackground>
      <View className="bg-white rounded-2xl p-5 border border-[#E3E8DE] mb-8">
        <View className={`gap-4 ${desktop ? "flex-row items-center" : ""}`}>
          <View className="flex-1">
            <Text className="text-[9px] font-bold tracking-widest text-muted mb-2">
              PICKUP LOCATION
            </Text>
            <Pressable
              onPress={() =>
                setArea(area === "Anywhere" ? "San Francisco" : "Anywhere")
              }
              className="flex-row items-center gap-2 py-2"
            >
              <Icon name="pin" size={18} />
              <Text className="text-sm text-ink">
                {area === "Anywhere" ? "Anywhere in Camotes" : area} ⌄
              </Text>
            </Pressable>
          </View>
          <View className="flex-1">
            <Text className="text-[9px] font-bold tracking-widest text-muted mb-2">
              YOUR DATES
            </Text>
            <Pressable
              onPress={() => router.push("/availability")}
              className="flex-row items-center gap-2 py-2"
            >
              <Icon name="calendar" size={18} />
              <Text className="text-sm text-ink">Oct 22 — Oct 24, 2026</Text>
            </Pressable>
          </View>
          <View className="flex-1">
            <Text className="text-[9px] font-bold tracking-widest text-muted mb-2">
              FIND YOUR RIDE
            </Text>
            <TextInput
              accessibilityLabel="Search vehicles"
              value={search}
              onChangeText={setSearch}
              placeholder="Vehicle, model, or town"
              placeholderTextColor="#899388"
              className="text-sm text-ink py-2"
            />
          </View>
          <Button title="Find a ride  ↗" onPress={() => setFilters(true)} />
        </View>
      </View>
      <View className={`gap-7 ${desktop ? "flex-row" : ""}`}>
        <View className="flex-1">
          <Heading
            title="Your ride, your rhythm"
            sub="From coastal cruises to family adventures. We’ve got the keys."
            action="Filters"
            onAction={() => setFilters(!filters)}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-5"
            contentContainerStyle={{ gap: 8 }}
          >
            {["All vehicles", "Cars", "SUVs", "Motorcycles", "Vans"].map(
              (c) => (
                <Chip
                  key={c}
                  title={c}
                  selected={c === category}
                  onPress={() => setCategory(c)}
                />
              ),
            )}
          </ScrollView>
          {filters && (
            <Card>
              <Heading title="Make it your kind of ride" />
              <Text className="text-xs text-muted mb-3">Daily budget</Text>
              <View className="flex-row gap-2 mb-4">
                {["Any price", "Under ₱1,500"].map((x) => (
                  <Chip
                    key={x}
                    title={x}
                    selected={budget === x}
                    onPress={() => setBudget(x)}
                  />
                ))}
              </View>
              <Text className="text-xs text-muted mb-3">Transmission</Text>
              <View className="flex-row gap-2 mb-4">
                {["Any", "Automatic", "Manual"].map((x) => (
                  <Chip
                    key={x}
                    title={x}
                    selected={transmission === x}
                    onPress={() => setTransmission(x)}
                  />
                ))}
              </View>
              <Text className="text-xs text-muted mb-3 mt-4">Pickup area</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {["Anywhere", "San Francisco", "Poro", "Tudela", "Pilar"].map(
                  (x) => (
                    <Chip
                      key={x}
                      title={x}
                      selected={area === x}
                      onPress={() => setArea(x)}
                    />
                  ),
                )}
              </View>
              <Text className="text-xs text-muted mb-3">Seats</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {["Any seats", "7+ seats"].map((x) => (
                  <Chip
                    key={x}
                    title={x}
                    selected={seats === x}
                    onPress={() => setSeats(x)}
                  />
                ))}
              </View>
              <Button
                title="Reset filters"
                secondary
                onPress={() => {
                  setBudget("Any price");
                  setArea("Anywhere");
                  setTransmission("Any");
                  setSeats("Any seats");
                  setCategory("All vehicles");
                  setSearch("");
                }}
              />
            </Card>
          )}
          <Text className="text-[11px] text-muted mb-4">
            {results.length} rides ready for your next adventure
          </Text>
          <View className="flex-row flex-wrap gap-5">
            {results.map((v) => (
              <View
                key={v.id}
                style={{ width: width >= 740 ? "47.5%" : "100%" }}
              >
                <VehicleCard vehicle={v} />
              </View>
            ))}
          </View>
          {results.length === 0 && (
            <Card>
              <Text className="text-ink font-semibold">No rides found</Text>
              <Text className="text-muted text-sm mt-2">
                Try a different town or reset your filters.
              </Text>
            </Card>
          )}
        </View>
        {desktop && (
          <View className="w-[280px]">
            <Card>
              <View className="bg-mint rounded-full w-11 h-11 items-center justify-center mb-4">
                <Icon name="check" />
              </View>
              <Text className="text-lg font-semibold text-ink">
                Good rides. Good people.
              </Text>
              <Text className="text-xs text-muted leading-5 mt-3">
                Book with confidence. Every vehicle and owner is verified by our
                local team.
              </Text>
              {[
                "Verified local owners",
                "Clear pricing, no surprises",
                "Support from real islanders",
              ].map((x) => (
                <View key={x} className="flex-row gap-3 mt-4">
                  <Text className="text-ocean text-xs">✓</Text>
                  <Text className="text-[11px] text-ink">{x}</Text>
                </View>
              ))}
            </Card>
            <View className="bg-[#EFEBDD] rounded-3xl p-6 mb-5">
              <Text className="text-[9px] tracking-[2px] text-[#8A7859] mb-4">
                A LOCAL LITTLE SECRET
              </Text>
              <Text className="text-2xl font-semibold text-[#4F5238] leading-8">
                Take the{"\n"}scenic route.
              </Text>
              <Text className="text-xs text-[#7B7B63] leading-5 mt-3">
                Santiago Bay at sunset. Lake Danao on a quiet morning. The best
                stops aren’t on a schedule.
              </Text>
              <ImageBackground
                source={beach}
                imageStyle={{ borderRadius: 16 }}
                style={{ height: 115, marginTop: 20 }}
              />
              <Text className="text-[10px] text-[#7B7B63] mt-3">
                ⌖ Santiago Bay, San Francisco
              </Text>
            </View>
            <Pressable
              onPress={() => {
                router.push("/profile");
              }}
              className="border border-[#DFE5D9] rounded-2xl p-5"
            >
              <Text className="text-sm font-semibold text-ocean">
                Have a vehicle to share? ↗
              </Text>
              <Text className="text-xs text-muted mt-2">
                Turn your parked ride into possibility.
              </Text>
            </Pressable>
          </View>
        )}
      </View>
      <View className="bg-mint rounded-3xl p-6 mt-8 flex-row gap-4 items-center">
        <Icon name="pin" size={30} />
        <View className="flex-1">
          <Text className="font-semibold text-ocean text-sm">
            Island roots. Open roads.
          </Text>
          <Text className="text-xs text-muted mt-2 leading-5">
            Proudly connecting travelers with local owners across San Francisco,
            Poro, Tudela, and Pilar.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

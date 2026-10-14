import { Image, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Heading,
  Row,
  Screen,
} from "@/components/camotes/ui";
import { money, vehicles } from "@/data/mock";
import { useDemo } from "@/state/demo";
export default function VehicleDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const v = vehicles.find((x) => x.id === id);
  const { favorites, toggleFavorite, chauffeur } = useDemo();
  if (!v)
    return (
      <Screen title="Vehicle not found" back>
        <Button title="Explore rides" onPress={() => router.replace("/")} />
      </Screen>
    );
  return (
    <Screen back>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        className="mb-6"
        contentContainerStyle={{ gap: 12 }}
      >
        <Image
          source={v.image}
          style={{ width: 340, height: 260, borderRadius: 24 }}
        />
        <Image
          source={v.image}
          style={{ width: 340, height: 260, borderRadius: 24 }}
        />
      </ScrollView>
      <Badge text="VERIFIED VEHICLE · SELF-DRIVE" />
      <View className="mt-4">
        <Heading
          title={v.name}
          sub={`${v.year} · ${v.area} · ★ ${v.rating} (${v.reviews} reviews)`}
        />
      </View>
      <Card>
        <Heading
          title="A little freedom, on four wheels"
          sub="A well-kept local ride for your island days. Pick up near the port and explore at your own pace."
        />
        <Row title="Transmission" detail={v.transmission} />
        <Row title="Seats / fuel" detail={`${v.seats} seats · ${v.fuel}`} />
        <Row title="Daily rental" detail={money(v.price)} />
        <Row title="Refundable security deposit" detail={money(v.deposit)} />
        <Row
          title="Service"
          detail={
            chauffeur ? "Self-drive or verified chauffeur" : "Self-drive only"
          }
        />
      </Card>
      <Card>
        <Heading title="Meet your local owner" />
        <Text className="font-semibold text-ocean">{v.owner} ✓ Verified</Text>
        <Text className="text-xs text-muted mt-3 leading-5">
          Usually replies within 2 hours. Contact details become available after
          your booking is confirmed.
        </Text>
      </Card>
      <Card>
        <Heading title="Before you hit the road" />
        {[
          "Verified driver’s license and government ID required",
          "Return with the same fuel level",
          "Camotes Islands use only; no off-island transport",
          "24-hour rental days; pickup and return at 9:00 AM",
          "Free cancellation until 48 hours before pickup",
          "Only named, license-verified authorized drivers may drive",
        ].map((x) => (
          <Row key={x} title={x} />
        ))}
      </Card>
      <Card>
        <Heading title="Loved by island explorers" />
        <Text className="text-[#C59947] mb-2">★★★★★</Text>
        <Text className="text-sm text-ink leading-6">
          “Easy pickup at Consuelo, spotless ride, and such a kind owner. The
          perfect way to see Camotes!”
        </Text>
        <Text className="text-xs text-muted mt-3">
          Jamie L. · October 2026 · Verified rental
        </Text>
      </Card>
      <View className="gap-3">
        <Button
          title={`Reserve your ride · ${money(v.price)} / day`}
          onPress={() =>
            router.push({ pathname: "/booking", params: { vehicleId: v.id } })
          }
        />
        <Button
          secondary
          title={
            favorites.includes(v.id)
              ? "♥ Saved to your favorites"
              : "♡ Save this ride"
          }
          onPress={() => toggleFavorite(v.id)}
        />
      </View>
    </Screen>
  );
}

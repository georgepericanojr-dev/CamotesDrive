import { Image, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Heading,
  Row as DetailRow,
  Screen,
} from "@/components/camotes/ui";
import { AsyncButton, ResourceState } from "@/components/camotes/api-ui";
import { useResource } from "@/hooks/use-resource";
import { useApp } from "@/state/app";
import { photoUrl } from "@/lib/api";
import { mapVehicle, money, text, manilaDate, type Row } from "@/data/models";
import { rentalDatesFromParams } from "@/lib/rental-dates";
import { renterHomeHref } from "@/lib/navigation";
export default function VehicleDetails() {
  const { id, startDate, endDate } = useLocalSearchParams<{
    id: string;
    startDate?: string;
    endDate?: string;
  }>();
  const rentalDates = rentalDatesFromParams(startDate, endDate, manilaDate(1));
  const { favorites, toggleFavorite } = useApp();
  const data = useResource<Row[]>(id ? `/vehicles/${id}` : null);
  const v = data.data?.[0] ? mapVehicle(data.data[0], photoUrl) : null;
  return (
    <Screen back>
      <ResourceState {...data} retry={data.refresh} />
      {v ? (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            className="mb-6"
            contentContainerStyle={{ gap: 12 }}
          >
            {Array.isArray(v.raw.photos) && v.raw.photos.length ? (
              v.raw.photos.map((p) => (
                <Image
                  key={text(p)}
                  source={{ uri: photoUrl(text(p)) }}
                  style={{ width: 330, height: 250, borderRadius: 24 }}
                />
              ))
            ) : (
              <Image
                source={v.image}
                style={{ width: 330, height: 250, borderRadius: 24 }}
              />
            )}
          </ScrollView>
          <Badge text="VERIFIED VEHICLE" />
          <View className="mt-4">
            <Heading
              title={v.name}
              sub={`${v.year} · ${v.area} · ${v.rating === "New" ? "No reviews yet" : `★ ${v.rating} (${v.reviews} reviews)`}`}
            />
          </View>
          <Card>
            <Heading title="Your island ride" />
            <DetailRow title="Transmission" detail={v.transmission} />
            <DetailRow
              title="Seats / fuel"
              detail={`${v.seats} seats · ${v.fuel}`}
            />
            <DetailRow title="Daily rental" detail={money(v.price)} />
            <DetailRow
              title="Refundable deposit · separate"
              detail={money(v.deposit)}
            />
            <DetailRow title="Local owner" detail={v.owner} />
            <DetailRow
              title="Minimum age"
              detail={`${text(v.raw.minimum_renter_age)} · verified license required`}
            />
            <Text className="text-sm text-muted leading-6 mt-4">
              {text(v.raw.rules) ||
                "Ask your owner about fuel policy and island limits before pickup."}
            </Text>
            <Text className="text-xs text-muted mt-4">
              Only the renter and named, verified authorized drivers may operate
              a self-drive rental. Contact details appear after confirmation.
            </Text>
          </Card>
          <View className="gap-3">
            <Button
              title={`Reserve · ${money(v.price)} / day`}
              onPress={() =>
                router.push({
                  pathname: "/booking",
                  params: { vehicleId: v.id, ...rentalDates },
                })
              }
            />
            <AsyncButton
              secondary
              title={
                favorites.includes(v.id)
                  ? "♥ Saved to favorites"
                  : "♡ Save this ride"
              }
              onPress={() => toggleFavorite(v.id)}
            />
          </View>
        </>
      ) : (
        data.data && (
          <Card>
            <Text className="text-muted mb-4">
              This ride is currently unavailable.
            </Text>
            <Button
              title="Explore other rides"
              onPress={() => router.replace(renterHomeHref)}
            />
          </Card>
        )
      )}
    </Screen>
  );
}

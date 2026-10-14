import { useState } from "react";
import { Image, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Chip,
  Heading,
  Screen,
} from "@/components/camotes/ui";
import { dateLabel, vehicles } from "@/data/mock";
import { useDemo } from "@/state/demo";
export default function Trips() {
  const { trips, mode } = useDemo();
  const [tab, setTab] = useState("Upcoming");
  const results = trips.filter((t) =>
    tab === "Upcoming"
      ? ["Confirmed", "Pending owner", "Pending driver"].includes(t.status)
      : tab === "Ongoing"
        ? ["In progress", "En route"].includes(t.status)
        : tab === "Past"
          ? t.status === "Completed"
          : ["Cancelled", "Declined", "Expired", "No show"].includes(t.status),
  );
  return (
    <Screen
      title={mode === "Owner" ? "Your bookings" : "Your island days"}
      subtitle="Every adventure, all in one place."
    >
      <View className="flex-row flex-wrap gap-2 mb-6">
        {["Upcoming", "Ongoing", "Past", "Cancelled"].map((x) => (
          <Chip
            key={x}
            title={x}
            selected={tab === x}
            onPress={() => setTab(x)}
          />
        ))}
      </View>
      {results.map((t) => {
        const v = vehicles.find((x) => x.id === t.vehicleId)!;
        return (
          <Card key={t.id}>
            <View className="flex-row gap-4">
              <Image
                source={v.image}
                style={{ width: 86, height: 86, borderRadius: 16 }}
              />
              <View className="flex-1">
                <Badge
                  text={t.status.toUpperCase()}
                  warm={t.status.includes("Pending")}
                />
                <Text className="text-lg font-semibold text-ink mt-2">
                  {v.name}
                </Text>
                <Text className="text-xs text-muted mt-2">
                  {dateLabel(t.start)} — {dateLabel(t.end)} · {t.days} days
                </Text>
              </View>
            </View>
            <Text className="text-xs text-muted my-4">
              ⌖ {t.pickup} · 9:00 AM pickup · {t.id}
            </Text>
            <Button
              title="View trip details  ↗"
              secondary
              onPress={() =>
                router.push({ pathname: "/trip/[id]", params: { id: t.id } })
              }
            />
          </Card>
        );
      })}
      {!results.length && (
        <Card>
          <Heading
            title="Room for a new adventure"
            sub={`No ${tab.toLowerCase()} trips just yet.`}
          />
          <Button
            title="Find your next ride"
            onPress={() => router.push("/")}
          />
        </Card>
      )}
    </Screen>
  );
}

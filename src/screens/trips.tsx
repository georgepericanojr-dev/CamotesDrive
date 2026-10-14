import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Chip,
  Row as DetailRow,
  Screen,
} from "@/components/camotes/ui";
import { SignInRequired, ResourceState } from "@/components/camotes/api-ui";
import { useApp } from "@/state/app";
import { useResource } from "@/hooks/use-resource";
import { dateLabel, mapTrip, text, type Row } from "@/data/models";
import { photoUrl } from "@/lib/api";
export default function Trips() {
  const { signedIn, mode } = useApp();
  const [tab, setTab] = useState("Upcoming");
  const [page, setPage] = useState({ group: "", offset: 0 });
  const group = mode + tab;
  const offset = page.group === group ? page.offset : 0;
  const data = useResource<Row[]>(
    signedIn
      ? `/bookings?limit=25&offset=${offset}&mode=${mode.toLowerCase()}&status_group=${tab.toLowerCase()}`
      : null,
  );
  const results = data.data || [];
  return (
    <Screen
      title={mode === "Owner" ? "Your bookings" : "Your island days"}
      subtitle="Requests, confirmed rentals, and past adventures."
    >
      <SignInRequired />
      {signedIn && (
        <>
          <View className="flex-row flex-wrap gap-2 mb-6">
            {["Upcoming", "Ongoing", "Past", "Cancelled"].map((t) => (
              <Chip
                key={t}
                title={t}
                selected={t === tab}
                onPress={() => setTab(t)}
              />
            ))}
          </View>
          <ResourceState {...data} retry={data.refresh} />
          {results.map((b) => {
            const t = mapTrip(b, photoUrl);
            return (
              <Card key={t.id}>
                <Badge text={t.status.toUpperCase()} />
                <DetailRow
                  title={t.vehicle.name}
                  detail={`#${text(b.booking_number)}`}
                  onPress={() =>
                    router.push({
                      pathname: "/trip/[id]",
                      params: { id: t.id },
                    })
                  }
                />
                <Text className="text-xs text-muted my-3">
                  {dateLabel(t.start)} — {dateLabel(t.end)} · {t.pickup}
                </Text>
                <Button
                  secondary
                  title="View trip details"
                  onPress={() =>
                    router.push({
                      pathname: "/trip/[id]",
                      params: { id: t.id },
                    })
                  }
                />
              </Card>
            );
          })}
          {!data.loading && !results.length && (
            <Card>
              <Text className="text-muted text-sm">
                No {tab.toLowerCase()} trips yet.
              </Text>
            </Card>
          )}
          <View className="flex-row gap-3">
            <Button
              secondary
              title="Previous"
              disabled={!offset}
              onPress={() =>
                setPage({ group, offset: Math.max(0, offset - 25) })
              }
            />
            <Button
              secondary
              title="Next"
              disabled={!data.data || data.data.length < 25}
              onPress={() => setPage({ group, offset: offset + 25 })}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

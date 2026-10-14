import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  Badge,
  Card,
  Field,
  Row as DetailRow,
  Screen,
} from "@/components/camotes/ui";
import {
  AsyncButton,
  ResourceState,
  SignInRequired,
} from "@/components/camotes/api-ui";
import { text, rows, type Row } from "@/data/models";
import { useApp } from "@/state/app";
import { useResource } from "@/hooks/use-resource";
export function Messages() {
  const { signedIn, trips } = useApp();
  return (
    <Screen
      title="Good trips start with a hello"
      subtitle="Private conversations connected to your bookings."
    >
      <SignInRequired />
      {signedIn &&
        trips.map((t) => (
          <Card key={t.id}>
            <Badge text={`BOOKING #${text(t.raw.booking_number)}`} />
            <DetailRow
              title={t.vehicle.name}
              detail={t.status}
              onPress={() =>
                router.push({ pathname: "/chat/[id]", params: { id: t.id } })
              }
            />
          </Card>
        ))}
      {signedIn && !trips.length && (
        <Card>
          <Text className="text-muted">
            Your booking conversations will appear here.
          </Text>
        </Card>
      )}
    </Screen>
  );
}
export function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { signedIn, session, mutate, toast } = useApp();
  const data = useResource<Row>(
    signedIn && id ? `/bookings/${id}/messages?limit=50` : null,
    8000,
  );
  const booking = useResource<Row>(signedIn && id ? `/bookings/${id}` : null);
  const [draft, setDraft] = useState("");
  const [messageId, setMessageId] = useState(() => randomUUID());
  const [blocked, setBlocked] = useState(false);
  const other = booking.data
    ? booking.data.owner_id === session?.user.id
      ? text(booking.data.renter_id)
      : text(booking.data.owner_id)
    : "";
  return (
    <Screen title="Booking conversation" subtitle={id} back>
      <SignInRequired />
      <ResourceState {...data} retry={data.refresh} />
      {signedIn && data.data && (
        <Card>
          <Badge text="BOOKING PARTICIPANTS ONLY" />
          <View className="gap-4 my-6">
            {rows(data.data.messages).map((m) => (
              <View
                key={text(m.id)}
                className={`rounded-2xl p-4 max-w-[85%] ${m.sender_id === session?.user.id ? "self-end bg-ocean" : "self-start bg-mint"}`}
              >
                <Text
                  className={`text-sm leading-6 ${m.sender_id === session?.user.id ? "text-white" : "text-ink"}`}
                >
                  {text(m.body)}
                </Text>
                <Text className="text-[10px] text-muted mt-2">
                  {new Date(text(m.created_at)).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                  })}
                </Text>
              </View>
            ))}
          </View>
          <Field
            label="Your message"
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              setMessageId(randomUUID());
            }}
            multiline
          />
          <AsyncButton
            title="Send message"
            disabled={!draft.trim() || blocked}
            onPress={async () => {
              await mutate("/messages", {
                booking_id: id,
                body: draft,
                request_id: messageId,
              });
              setDraft("");
              setMessageId(randomUUID());
              data.refresh();
            }}
          />
          <View className="gap-3 mt-4">
            <AsyncButton
              secondary
              title="Report this conversation"
              onPress={async () => {
                await mutate("/reports", {
                  booking_id: id,
                  category: "message",
                  description: "Please review this booking conversation.",
                });
                toast("Conversation reported for review.");
              }}
            />
            {!!other && (
              <AsyncButton
                secondary
                title={blocked ? "Unblock user" : "Block user"}
                onPress={async () => {
                  await mutate("/blocks", {
                    user_id: other,
                    blocked: !blocked,
                  });
                  setBlocked(!blocked);
                }}
              />
            )}
          </View>
        </Card>
      )}
    </Screen>
  );
}
export function Notifications() {
  const { signedIn, mutate } = useApp();
  const data = useResource<Row[]>(signedIn ? "/notifications?limit=50" : null);
  return (
    <Screen
      title="A little island update"
      subtitle="Your account’s latest notifications."
    >
      <SignInRequired />
      <ResourceState {...data} retry={data.refresh} />
      {signedIn && (
        <>
          <AsyncButton
            secondary
            title="Mark all read"
            onPress={async () => {
              await mutate("/notifications/read", {});
              data.refresh();
            }}
          />
          <View className="mt-5">
            {data.data?.map((n) => (
              <Card key={text(n.id)}>
                <Badge
                  text={`${text(n.mode).toUpperCase()} · ${n.read_at ? "READ" : "NEW"}`}
                />
                <DetailRow
                  title={text(n.title)}
                  onPress={() => {
                    void mutate("/notifications/read", { id: n.id }).then(
                      () => {
                        data.refresh();
                        if (n.booking_id)
                          router.push({
                            pathname: "/trip/[id]",
                            params: { id: text(n.booking_id) },
                          });
                      },
                    );
                  }}
                />
                <Text className="text-xs text-muted mt-3">{text(n.body)}</Text>
              </Card>
            ))}
            {data.data?.length === 0 && (
              <Card>
                <Text className="text-muted">You’re all caught up.</Text>
              </Card>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

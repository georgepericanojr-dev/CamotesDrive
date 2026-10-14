import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Field,
  Heading,
  Row,
  Screen,
} from "@/components/camotes/ui";
import { useDemo } from "@/state/demo";
import { vehicles } from "@/data/mock";
export function Messages() {
  const { trips } = useDemo();
  return (
    <Screen
      title="Good trips start with a hello"
      subtitle="Conversations are private and connected to your booking."
    >
      {trips.map((t) => {
        const v = vehicles.find((x) => x.id === t.vehicleId)!;
        return (
          <Card key={t.id}>
            <Badge text={`${t.id} · RENTER / OWNER`} />
            <Row
              title={v.owner}
              detail="9:41 AM"
              onPress={() =>
                router.push({ pathname: "/chat/[id]", params: { id: t.id } })
              }
            />
            <Text className="text-xs text-muted mt-3">
              {v.name} · See you at the port! I’ll be near the entrance.
            </Text>
          </Card>
        );
      })}
    </Screen>
  );
}
export function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toast, trips } = useDemo();
  const t = trips.find((x) => x.id === id);
  const v = vehicles.find((x) => x.id === t?.vehicleId);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([
    {
      text: "Hello Alex! Thanks for choosing a local ride. Happy to help with your island plans.",
      mine: false,
    },
    {
      text: "We’ll meet at the main entrance of the pickup point. Just send a message when you arrive.",
      mine: false,
    },
  ]);
  const [blocked, setBlocked] = useState(false);
  if (!t)
    return (
      <Screen title="Conversation unavailable" back>
        <Text className="text-muted">A valid booking is required.</Text>
      </Screen>
    );
  return (
    <Screen
      title={v?.owner || "Booking chat"}
      subtitle={`${id} · ${v?.name}`}
      back
    >
      <Card>
        <Badge text="BOOKING-SCOPED CONVERSATION" />
        <View className="gap-4 mt-6 mb-6">
          {messages.map((m, i) => (
            <View
              key={i}
              className={`rounded-2xl p-4 max-w-[85%] ${m.mine ? "self-end bg-ocean" : "self-start bg-mint"}`}
            >
              <Text
                className={`text-sm leading-6 ${m.mine ? "text-white" : "text-ink"}`}
              >
                {m.text}
              </Text>
              <Text
                className={`text-[9px] mt-2 ${m.mine ? "text-white/70" : "text-muted"}`}
              >
                9:41 AM · {m.mine ? "Sent locally" : "Owner"}
              </Text>
            </View>
          ))}
        </View>
        <Field
          label="Your message"
          value={draft}
          onChangeText={setDraft}
          placeholder={blocked ? "This user is blocked" : "Say hello…"}
          multiline
        />
        <Button
          title="Send message  ↗"
          disabled={!draft.trim() || blocked}
          onPress={() => {
            setMessages((old) => [...old, { text: draft, mine: true }]);
            setDraft("");
          }}
        />
        <Row
          title="Report conversation"
          onPress={() => toast("Demo report submitted for review.")}
        />
        <Row
          title={blocked ? "Unblock user" : "Block user"}
          onPress={() => {
            setBlocked(!blocked);
            toast(
              blocked
                ? "User unblocked."
                : "User blocked in this demo conversation.",
            );
          }}
        />
      </Card>
    </Screen>
  );
}
export function Notifications() {
  const [read, setRead] = useState<string[]>([]);
  return (
    <Screen
      title="A little island update"
      subtitle="One inbox, all your modes."
    >
      <Heading
        title="Today"
        action="Mark all read"
        onAction={() => setRead(["trip", "payment", "document"])}
      />
      {[
        [
          "trip",
          "Your Toyota Fortuner is confirmed",
          "Renter · Pickup at Consuelo Port, Oct 22.",
          "/trip/CD-1028",
        ],
        [
          "payment",
          "A new booking needs your reply",
          "Owner · Respond within 24 hours.",
          "/provider",
        ],
        [
          "document",
          "Your verification is approved",
          "Driver · Your professional license is verified.",
          "/verification",
        ],
      ].map(([id, title, text, href]) => (
        <Card key={id}>
          <Badge text={read.includes(id) ? "READ" : "NEW"} />
          <Row
            title={title}
            onPress={() => {
              setRead((old) => [...old, id]);
              router.push(href as Parameters<typeof router.push>[0]);
            }}
          />
          <Text className="text-xs text-muted mt-3">{text}</Text>
        </Card>
      ))}
    </Screen>
  );
}

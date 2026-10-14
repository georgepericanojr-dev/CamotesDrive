import { useState } from "react";
import { Text } from "react-native";
import {
  Card,
  Heading,
  Row,
  Screen,
  Field,
  Button,
} from "@/components/camotes/ui";
import { useDemo } from "@/state/demo";
export function Support() {
  const { toast } = useDemo();
  const [message, setMessage] = useState("");
  return (
    <Screen
      title="A real person, a little help"
      subtitle="Your island support corner."
      back
    >
      <Card>
        <Heading title="Frequently asked questions" />
        <Row title="How do payments work?" />
        <Text className="text-xs text-muted leading-5 my-3">
          Pay your owner by cash, GCash, Maya, or bank transfer. Submit your
          payment reference from your trip. The owner or admin verifies receipt.
        </Text>
        <Row title="When can I cancel?" />
        <Text className="text-xs text-muted leading-5 my-3">
          Free cancellation until 48 hours before pickup. Later cancellations
          follow the policy shown before booking.
        </Text>
        <Row title="Can I hire a driver?" />
        <Text className="text-xs text-muted leading-5 my-3">
          Chauffeured rentals become available only after platform TNC
          accreditation and vehicle / professional driver approvals. This
          prototype defaults to self-drive.
        </Text>
      </Card>
      <Card>
        <Heading title="Tell us what happened" />
        <Field
          label="Support request or dispute details"
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <Button
          title="Submit demo support request"
          disabled={!message.trim()}
          onPress={() => {
            toast(
              "Your demo request was recorded locally. No support message was sent.",
            );
            setMessage("");
          }}
        />
      </Card>
    </Screen>
  );
}
export function Legal() {
  return (
    <Screen
      title="A clear road ahead"
      subtitle="Preview terms & privacy · Draft copy for UI review"
      back
    >
      {[
        [
          "Rental terms",
          "Rentals are physical services paid directly to the owner. Only verified, named drivers may operate a self-drive vehicle. Follow the fuel policy, island limits, and pickup / return agreement. Security deposits are shown separately and may cover documented damage.",
        ],
        [
          "Cancellation policy",
          "Free cancellation until 48 hours before pickup. Later cancellations may receive partial or no refund according to the confirmed booking terms. Provider cancellations qualify for a full refund.",
        ],
        [
          "Privacy & document consent",
          "Identity and license documents are collected only for verification and eligibility. In production they must be private and accessible only to authorized reviewers and the document owner. This demo uploads no documents and calls no backend.",
        ],
        [
          "Account deletion & retention",
          "Profiles and saved vehicles can be deleted. Booking, payment, and dispute records may be retained for legal and dispute obligations according to the final retention policy.",
        ],
        [
          "Data requests",
          "Use Help & Support to request access, correction, or deletion of your data. Final legal text and the business data protection contact must be supplied before launch.",
        ],
      ].map(([title, text]) => (
        <Card key={title}>
          <Heading title={title} />
          <Text className="text-sm text-muted leading-6">{text}</Text>
        </Card>
      ))}
    </Screen>
  );
}

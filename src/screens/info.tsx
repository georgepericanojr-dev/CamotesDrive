import { useState } from "react";
import { Text } from "react-native";
import {
  Card,
  Heading,
  Row as DetailRow,
  Screen,
  Field,
} from "@/components/camotes/ui";
import { useApp } from "@/state/app";
import { AsyncButton, SignInRequired } from "@/components/camotes/api-ui";
export function Support() {
  const { toast, mutate, signedIn } = useApp();
  const [message, setMessage] = useState("");
  return (
    <Screen
      title="A real person, a little help"
      subtitle="Your island support corner."
      back
    >
      <SignInRequired />
      <Card>
        <Heading title="Frequently asked questions" />
        <DetailRow title="How do payments work?" />
        <Text className="text-xs text-muted leading-5 my-3">
          Pay your owner by cash, GCash, Maya, or bank transfer. Submit your
          payment reference from your trip. The owner or admin verifies receipt.
        </Text>
        <DetailRow title="When can I cancel?" />
        <Text className="text-xs text-muted leading-5 my-3">
          Free cancellation until 48 hours before pickup. Later cancellations
          follow the policy shown before booking.
        </Text>
        <DetailRow title="Can I hire a driver?" />
        <Text className="text-xs text-muted leading-5 my-3">
          Chauffeured rentals become available only after platform TNC
          accreditation and vehicle / professional driver approvals. This
          service is available only when the platform accreditation is active.
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
        <AsyncButton
          title="Submit support request"
          disabled={!message.trim() || !signedIn}
          onPress={async () => {
            await mutate("/reports", {
              category: "other",
              description: message,
            });
            toast("Support request submitted.");
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
          "Identity and license documents are collected for verification and eligibility, stored privately, and accessible only to authorized reviewers and the document owner.",
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

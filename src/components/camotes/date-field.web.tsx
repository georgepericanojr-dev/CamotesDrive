import { useId } from "react";
import { Pressable, Text, View } from "react-native";
import {
  getDateBounds,
  getDateFieldError,
  isDateOnly,
} from "../../lib/date-only";
import type { DateFieldProps } from "./date-field.types";

export type { DateFieldProps } from "./date-field.types";

export function DateField({
  label,
  value,
  onChangeText,
  minimumDate,
  maximumDate,
  optional = false,
  helperText,
  disabled = false,
}: DateFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const { minimum, maximum } = getDateBounds(minimumDate, maximumDate);
  const error = getDateFieldError(value, minimumDate, maximumDate);

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <label
          htmlFor={id}
          style={{ color: "#1B302A", fontSize: 12, fontWeight: 600 }}
        >
          {label}
          {optional ? " (optional)" : ""}
        </label>
        {optional && !!value && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label.toLowerCase()}`}
            disabled={disabled}
            hitSlop={8}
            onPress={() => onChangeText("")}
            className="min-h-8 justify-center px-1"
          >
            <Text className="text-xs font-semibold text-ocean">Clear</Text>
          </Pressable>
        )}
      </View>
      <input
        id={id}
        type="date"
        value={isDateOnly(value) ? value : ""}
        min={minimum ? minimumDate : undefined}
        max={maximum ? maximumDate : undefined}
        required={!optional}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helperText ? messageId : undefined}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (
            (next === "" && optional) ||
            (isDateOnly(next) &&
              !getDateFieldError(next, minimumDate, maximumDate))
          )
            onChangeText(next);
        }}
        style={{
          width: "100%",
          minWidth: 0,
          minHeight: 56,
          boxSizing: "border-box",
          border: `1px solid ${error ? "#AD4527" : "#DCE3DA"}`,
          borderRadius: 12,
          padding: 16,
          backgroundColor: "#FFFFFF",
          color: "#1B302A",
          accentColor: "#164E43",
          colorScheme: "light",
          fontFamily: "inherit",
          fontSize: 14,
          opacity: disabled ? 0.5 : 1,
        }}
      />
      {!!(error || helperText) && (
        <Text
          nativeID={messageId}
          accessibilityLiveRegion={error ? "polite" : undefined}
          className={`mt-2 text-xs ${error ? "text-[#AD4527]" : "text-muted"}`}
        >
          {error || helperText}
        </Text>
      )}
    </View>
  );
}

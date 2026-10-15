import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  clampDateOnly,
  formatDateOnly,
  getDateBounds,
  getDateFieldError,
  parseDateOnly,
} from "../../lib/date-only";
import type { DateFieldProps } from "./date-field.types";

export type { DateFieldProps } from "./date-field.types";

export function DateField({
  label,
  value,
  onChangeText,
  minimumDate,
  maximumDate,
  initialDate,
  optional = false,
  helperText,
  disabled = false,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const { minimum, maximum } = getDateBounds(minimumDate, maximumDate);
  const error = getDateFieldError(value, minimumDate, maximumDate);
  const selected = parseDateOnly(value);
  const displayValue = selected
    ? selected.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Choose date";

  const openPicker = () => {
    const initial =
      (selected && value) ||
      (initialDate && parseDateOnly(initialDate) && initialDate) ||
      formatDateOnly(new Date());
    const safeDate = parseDateOnly(
      clampDateOnly(initial, minimumDate, maximumDate),
    );
    if (safeDate) {
      setDraft(safeDate);
      setOpen(true);
    }
  };

  const commit = (date: Date) => {
    const next = formatDateOnly(date);
    if (next && !getDateFieldError(next, minimumDate, maximumDate)) {
      onChangeText(next);
    }
    setOpen(false);
  };

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text className="text-xs font-semibold text-ink">
          {label}
          {optional ? " (optional)" : ""}
        </Text>
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? displayValue : "no date selected"}`}
        accessibilityHint="Opens the date picker"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={openPicker}
        className={`min-h-14 flex-row items-center justify-between gap-3 rounded-xl border bg-white p-4 ${error ? "border-[#AD4527]" : "border-[#DCE3DA]"} ${disabled ? "opacity-50" : ""}`}
      >
        <Text className={`text-sm ${selected ? "text-ink" : "text-muted"}`}>
          {displayValue}
        </Text>
        <View
          accessible={false}
          className="h-5 w-5 rounded border-[1.5px] border-ocean"
        >
          <View className="mt-1 h-[1.5px] w-full bg-ocean" />
          <View className="absolute -top-1 left-1 h-2 w-[1.5px] bg-ocean" />
          <View className="absolute -top-1 right-1 h-2 w-[1.5px] bg-ocean" />
          <View className="m-1 h-1 w-1 bg-ocean" />
        </View>
      </Pressable>
      {!!(error || helperText) && (
        <Text
          accessibilityLiveRegion={error ? "polite" : undefined}
          className={`mt-2 text-xs ${error ? "text-[#AD4527]" : "text-muted"}`}
        >
          {error || helperText}
        </Text>
      )}
      {open && Platform.OS === "android" && (
        <DateTimePicker
          value={draft}
          mode="date"
          presentation="dialog"
          minimumDate={minimum ?? undefined}
          maximumDate={maximum ?? undefined}
          accentColor="#164E43"
          positiveButton={{ label: "Done" }}
          negativeButton={{ label: "Cancel" }}
          onValueChange={(_, date) => commit(date)}
          onDismiss={() => setOpen(false)}
        />
      )}
      {Platform.OS !== "android" && (
        <Modal
          visible={open}
          transparent
          animationType="none"
          onRequestClose={() => setOpen(false)}
        >
          <View className="flex-1 items-center justify-end bg-black/40 p-4">
            <Pressable
              accessibilityLabel="Cancel date selection"
              className="absolute inset-0"
              onPress={() => setOpen(false)}
            />
            <View
              accessibilityViewIsModal
              className="max-h-[85%] w-full max-w-md rounded-3xl bg-sand p-5"
            >
              <ScrollView bounces={false}>
                <Text
                  accessibilityRole="header"
                  className="text-lg font-semibold text-ink"
                >
                  {label}
                </Text>
                <DateTimePicker
                  value={draft}
                  mode="date"
                  display="spinner"
                  minimumDate={minimum ?? undefined}
                  maximumDate={maximum ?? undefined}
                  accentColor="#164E43"
                  themeVariant="light"
                  style={{ width: "100%" }}
                  onValueChange={(_, date) => setDraft(date)}
                />
                <View className="mt-4 flex-row gap-3">
                  <Pressable
                    accessibilityRole="button"
                    className="min-h-12 flex-1 items-center justify-center rounded-xl border border-[#DCE3DA] bg-white px-4"
                    onPress={() => setOpen(false)}
                  >
                    <Text className="font-semibold text-ocean">Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    className="min-h-12 flex-1 items-center justify-center rounded-xl bg-ocean px-4"
                    onPress={() => commit(draft)}
                  >
                    <Text className="font-semibold text-white">Done</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

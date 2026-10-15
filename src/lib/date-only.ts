/** Date-only values use local calendar components, never UTC conversion. */
export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(0);
  // Noon avoids ordinary daylight-saving transitions around midnight.
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

export function formatDateOnly(date: Date): string {
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  if (year < 1 || year > 9999) return "";
  return [
    String(year).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function isDateOnly(value: string): boolean {
  return parseDateOnly(value) !== null;
}

export function addDateDays(value: string, days: number): string {
  const date = parseDateOnly(value);
  if (!date || !Number.isInteger(days)) return "";
  date.setDate(date.getDate() + days);
  return formatDateOnly(date);
}

/** Ignore malformed or contradictory bounds so an existing record can be repaired. */
export function getDateBounds(minimumDate?: string, maximumDate?: string) {
  let minimum = minimumDate ? parseDateOnly(minimumDate) : null;
  let maximum = maximumDate ? parseDateOnly(maximumDate) : null;
  if (minimum && maximum && minimum > maximum) {
    minimum = null;
    maximum = null;
  }
  return { minimum, maximum };
}

export function clampDateOnly(
  value: string,
  minimumDate?: string,
  maximumDate?: string,
): string {
  const date = parseDateOnly(value);
  if (!date) return "";
  const { minimum, maximum } = getDateBounds(minimumDate, maximumDate);
  if (minimum && date < minimum) return formatDateOnly(minimum);
  if (maximum && date > maximum) return formatDateOnly(maximum);
  return value;
}

export function getDateFieldError(
  value: string,
  minimumDate?: string,
  maximumDate?: string,
): string | null {
  if (!value) return null;
  const date = parseDateOnly(value);
  if (!date) return "Choose a valid date.";
  const { minimum, maximum } = getDateBounds(minimumDate, maximumDate);
  if (minimum && date < minimum) {
    return `Choose ${formatDateOnly(minimum)} or later.`;
  }
  if (maximum && date > maximum) {
    return `Choose ${formatDateOnly(maximum)} or earlier.`;
  }
  return null;
}

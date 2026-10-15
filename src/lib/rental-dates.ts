import { addDateDays, isDateOnly } from "./date-only";

export type RentalDates = { startDate: string; endDate: string };

/** Query parameters are untrusted; only carry a complete, future date range. */
export function rentalDatesFromParams(
  startDate: unknown,
  endDate: unknown,
  earliest: string,
): RentalDates | null {
  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    !isDateOnly(startDate) ||
    !isDateOnly(endDate) ||
    !isDateOnly(earliest) ||
    startDate < earliest ||
    endDate <= startDate
  )
    return null;
  return { startDate, endDate };
}

/** Keep the return date within the listing's calendar-day rental limits. */
export function rentalEndForStart(
  startDate: string,
  currentEnd: string,
  minimumDays = 1,
  maximumDays?: number,
): string {
  if (
    !Number.isInteger(minimumDays) ||
    minimumDays < 1 ||
    (maximumDays !== undefined &&
      (!Number.isInteger(maximumDays) || maximumDays < minimumDays))
  )
    return "";
  const minimum = addDateDays(startDate, minimumDays);
  const maximum =
    maximumDays === undefined ? "" : addDateDays(startDate, maximumDays);
  if (!minimum) return "";
  if (!isDateOnly(currentEnd) || currentEnd < minimum) return minimum;
  return maximum && currentEnd > maximum ? maximum : currentEnd;
}

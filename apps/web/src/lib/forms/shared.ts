import { z } from "zod";

export const optionalLocalDateTime = z.union([
  z.literal(""),
  z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Enter a valid date and time",
  }),
]);

function localDateTimeParts(local: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!match) throw new RangeError("Invalid local date and time");
  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function buildFormatter(timeZone: string): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  };
  try {
    return new Intl.DateTimeFormat("en-CA", options);
  } catch {
    // Stored timezones predate validation and engines disagree on legacy
    // abbreviations, so an unusable zone degrades to UTC instead of throwing
    // out of a render.
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" });
  }
}

function datePartsInTimeZone(date: Date, timeZone: string): Record<string, number> {
  let formatter = dateTimeFormatters.get(timeZone);
  if (!formatter) {
    formatter = buildFormatter(timeZone);
    dateTimeFormatters.set(timeZone, formatter);
  }
  return formatter.formatToParts(date).reduce<Record<string, number>>((parts, part) => {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
    return parts;
  }, {});
}

export function fromIsoToLocalDateTime(
  iso: string | null | undefined,
  timeZone = "UTC",
): string {
  if (!iso) return "";
  const date = new Date(iso);
  const parts = datePartsInTimeZone(date, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${String(parts["year"])}-${pad(parts["month"] ?? 0)}-${pad(parts["day"] ?? 0)}T${pad(parts["hour"] ?? 0)}:${pad(parts["minute"] ?? 0)}`;
}

function resolveZonedIso(local: string, timeZone: string): string | null {
  const parts = localDateTimeParts(local);
  const desiredUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  let candidate = desiredUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zoned = datePartsInTimeZone(new Date(candidate), timeZone);
    const representedUtc = Date.UTC(
      zoned["year"] ?? 0,
      (zoned["month"] ?? 1) - 1,
      zoned["day"] ?? 1,
      zoned["hour"] ?? 0,
      zoned["minute"] ?? 0,
      zoned["second"] ?? 0,
    );
    const next = candidate + (desiredUtc - representedUtc);
    if (next === candidate) break;
    candidate = next;
  }
  const iso = new Date(candidate).toISOString();
  return fromIsoToLocalDateTime(iso, timeZone) === local.slice(0, 16) ? iso : null;
}

/** False when the local time falls in a DST spring-forward gap for the zone. */
export function localDateTimeExistsInZone(local: string, timeZone = "UTC"): boolean {
  if (!local) return true;
  try {
    return resolveZonedIso(local, timeZone) !== null;
  } catch {
    return false;
  }
}

export function toIsoOrUndefined(local: string, timeZone = "UTC"): string | undefined {
  if (!local) return undefined;
  const iso = resolveZonedIso(local, timeZone);
  if (iso === null) {
    throw new RangeError("The selected local time does not exist in this timezone");
  }
  return iso;
}

export function validateDateRange(
  value: { startDate: string; endDate: string; timezone?: string },
  context: z.RefinementCtx,
  timeZone: string | undefined = value.timezone,
): void {
  for (const field of ["startDate", "endDate"] as const) {
    if (!localDateTimeExistsInZone(value[field], timeZone)) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: "This local time does not exist in the selected timezone",
      });
    }
  }
  if (
    value.startDate &&
    value.endDate &&
    new Date(value.endDate).getTime() < new Date(value.startDate).getTime()
  ) {
    context.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date must be after the start date",
    });
  }
}

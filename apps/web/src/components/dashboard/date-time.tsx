"use client";

import { useSyncExternalStore } from "react";

// Server render and first paint use a fixed UTC format so SSR and CSR agree;
// once hydrated the value is shown in the operator's own locale and zone.
const utcFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

const localFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const subscribe = () => () => undefined;

export function DateTime({ value }: { value: string }): React.ReactElement {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const date = new Date(value);
  return (
    <span suppressHydrationWarning>
      {hydrated ? localFormatter.format(date) : utcFormatter.format(date)}
    </span>
  );
}

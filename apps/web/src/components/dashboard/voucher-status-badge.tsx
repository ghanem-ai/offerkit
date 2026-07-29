"use client";

import { T } from "gt-next/client";
import { Badge } from "@/components/ui/badge";
import type { VoucherStatus } from "@/lib/voucher-status";

// gt-next extracts keys statically, so each status needs its own literal <T>.
function StatusLabel({ status }: { status: VoucherStatus }): React.ReactElement {
  switch (status) {
    case "active":
      return <T>active</T>;
    case "scheduled":
      return <T>scheduled</T>;
    case "expired":
      return <T>expired</T>;
    default:
      return <T>inactive</T>;
  }
}

export function VoucherStatusBadge({
  status,
}: {
  status: VoucherStatus;
}): React.ReactElement {
  return (
    <Badge
      variant={
        status === "active" ? "default" : status === "expired" ? "destructive" : "secondary"
      }
    >
      <StatusLabel status={status} />
    </Badge>
  );
}

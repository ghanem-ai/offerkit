"use client";

import Link from "next/link";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { Plus, Search } from "lucide-react";
import { DataTable } from "@/components/dashboard/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ApiListItem, type OfferKitClient, ovx } from "@/lib/sdk";
import { VoucherStatusBadge } from "@/components/dashboard/voucher-status-badge";
import { voucherStatus } from "@/lib/voucher-status";

type VoucherRow = ApiListItem<OfferKitClient["vouchers"]["list"]>;

const sarFormatter = new Intl.NumberFormat("en-SA", {
  style: "currency",
  currency: "SAR",
  minimumFractionDigits: 2,
});

function formatSar(amountMinor: number): string {
  return sarFormatter.format(amountMinor / 100);
}

export default function VouchersPage() {
  const gt = useGT();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["vouchers", { search }],
    queryFn: () =>
      ovx().vouchers.list({
        search: search || undefined,
        campaignType: "DISCOUNT",
        limit: 25,
      }),
  });
  const columns: ColumnDef<VoucherRow>[] = [
    {
      accessorKey: "code",
      header: () => <T>Code</T>,
      cell: ({ row }) => (
        <Link className="font-mono text-sm hover:underline" href={`/vouchers/${row.original.code}`}>
          {row.original.code}
        </Link>
      ),
    },
    {
      id: "discount",
      header: () => <T>Reward</T>,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.discount?.type === "AMOUNT"
            ? formatSar(row.original.discount.amount ?? 0)
            : row.original.discount?.type === "PERCENTAGE"
              ? `${String((row.original.discount.percent ?? 0) / 100)}%`
              : "-"}
        </span>
      ),
    },
    {
      accessorKey: "redemptionCount",
      header: () => <div className="text-right"><T>Redemptions</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">
          {row.original.redemptionCount}
          {row.original.redemptionLimit ? ` / ${String(row.original.redemptionLimit)}` : ""}
        </div>
      ),
    },
    {
      id: "status",
      header: () => <div className="text-right"><T>Status</T></div>,
      cell: ({ row }) => {
        const status = voucherStatus(row.original);
        return (
          <div className="text-right">
            <VoucherStatusBadge status={status} />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <T>Promotion codes</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Redeemable fixed-SAR codes. Search by code.</T>
          </p>
        </div>
        <Button render={<Link href="/campaigns/new" />}>
          <Plus className="size-4" />
          <T>New promotion</T>
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={gt("Search by code")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage={<T>No promotion codes yet.</T>}
      />
    </div>
  );
}

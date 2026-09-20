"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import {
  VoucherForm,
  type VoucherFormState,
} from "@/components/dashboard/voucher-form";
import { voucherFormToUpdateInput } from "@/lib/forms/voucher";
import { fromIsoToLocalDateTime } from "@/lib/forms/shared";
import { formatMinorCurrency } from "@/lib/money";
import { ovx } from "@/lib/sdk";
import { VoucherStatusBadge } from "@/components/dashboard/voucher-status-badge";
import { voucherStatus } from "@/lib/voucher-status";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default function VoucherDetailPage({ params }: PageProps) {
  const { code } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();
  const [orderAmountSar, setOrderAmountSar] = useState(100);
  const [customerExternalId, setCustomerExternalId] = useState("");
  const [redeemKey, setRedeemKey] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vouchers", "code", code],
    queryFn: () => ovx().vouchers.get({ params: { code } }),
  });

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaigns", data?.campaignId],
    queryFn: () => ovx().campaigns.get({ params: { id: data?.campaignId ?? "" } }),
    enabled: Boolean(data?.campaignId),
  });
  const { data: workspace } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => ovx().workspace.get(),
  });

  const { data: customer } = useQuery({
    queryKey: ["customers", data?.customerId],
    queryFn: () => ovx().customers.get({ params: { id: data?.customerId ?? "" } }),
    enabled: Boolean(data?.customerId),
  });

  const update = useMutation({
    mutationFn: async (state: VoucherFormState) => {
      const patch = voucherFormToUpdateInput(
        state,
        campaign?.timezone ?? workspace?.defaultTimezone ?? "UTC",
      );
      if (state.customerExternalId) {
        const resolved = await ovx().customers.upsert({
          externalId: state.customerExternalId,
        });
        patch.customerId = resolved.customer.id;
      }
      return ovx().vouchers.update({
        params: { code },
        body: { patch },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(gt("Promotion code updated"));
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Update failed"));
    },
  });

  const remove = useMutation({
    mutationFn: () => ovx().vouchers.delete({ params: { code } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(gt("Promotion code deleted"));
      router.push("/vouchers");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Delete failed"));
    },
  });

  const validatePreview = useMutation({
    mutationFn: (amount: number) =>
      ovx().vouchers.validate({
        params: { code },
        body: {
          customerExternalId,
          order: { amount, currency: campaign?.currency ?? "", items: [] },
        },
      }),
  });

  const redeem = useMutation({
    mutationFn: (vars: { amount: number; idempotencyKey?: string }) =>
      ovx().vouchers.redeem({
        params: { code },
        body: {
          order: { amount: vars.amount, currency: campaign?.currency ?? "", items: [] },
          customerExternalId,
          idempotencyKey: vars.idempotencyKey,
        },
      }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["vouchers", "code", code] });
      if (res.ok) toast.success(gt("Redemption succeeded"));
      else toast.error(res.message ?? gt("Redemption failed"));
    },
  });

  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground">
        <T>Loading…</T>
      </p>
    );
  if (!data)
    return (
      <p className="text-sm text-muted-foreground">
        <T>Promotion code not found.</T>
      </p>
    );
  if (data.campaignId && campaignLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        <T>Loading…</T>
      </p>
    );
  }
  if (data.campaignId && !campaign) {
    return (
      <p className="text-sm text-muted-foreground">
        <T>Promotion not found; code dates cannot be edited safely.</T>
      </p>
    );
  }

  const discount = data.discount;
  const timeZone = campaign?.timezone ?? workspace?.defaultTimezone ?? "UTC";
  const initial: VoucherFormState = {
    app: "",
    code: data.code,
    campaignId: data.campaignId ?? "",
    type: data.type,
    discountKind: discount?.type ?? "AMOUNT",
    discountValue:
      discount?.type === "AMOUNT"
        ? (discount.amount ?? 0)
        : (discount?.percent ?? 0),
    maxDiscountAmount: discount?.maxDiscountAmount ?? "",
    giftBalance: data.giftBalance ?? "",
    redemptionLimit: data.redemptionLimit ?? "",
    perUserRedemptionLimit: data.perUserRedemptionLimit ?? "",
    customerId: customer?.externalId ? "" : (data.customerId ?? ""),
    customerExternalId: customer?.externalId ?? "",
    priority: data.priority,
    exclusive: data.exclusive,
    active: data.active,
    startDate: fromIsoToLocalDateTime(data.startDate, timeZone),
    endDate: fromIsoToLocalDateTime(data.endDate, timeZone),
  };

  const isGift = data.type === "GIFT_CARD";
  const campaignCurrency = campaign?.currency;
  const status = voucherStatus(data);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/vouchers" aria-label={gt("Back to promotion codes")} />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{data.code}</h1>
            <p className="text-sm text-muted-foreground">
              <T>Updated {new Date(data.updatedAt).toLocaleString()}</T>
            </p>
          </div>
          <VoucherStatusBadge status={status} />
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="outline" disabled={remove.isPending}>
              <Trash2 className="size-4" />
              <T>Delete</T>
            </Button>
          }
          title={gt("Delete this promotion code?")}
          description={gt(
            "The code is hidden. Redemption history is preserved.",
          )}
          confirmLabel={gt("Delete code")}
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </header>

      <VoucherForm
        ghanemOperatorMode
        timeZone={timeZone}
        key={`${data.updatedAt}:${customer?.updatedAt ?? ""}`}
        mode="edit"
        initial={initial}
        submitLabel={gt("Save changes")}
        pending={update.isPending}
        onSubmit={(state) => update.mutate(state)}
      />

      {isGift ? (
        <GiftCardLedger
          code={code}
          balance={data.giftBalance ?? 0}
          currency={campaignCurrency}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Test redemption</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="space-y-2">
              <Label htmlFor="order-amount">
                <T>Order amount (SAR)</T>
              </Label>
              <Input
                id="order-amount"
                type="number"
                inputMode="decimal"
                min={0.01}
                step={0.01}
                value={orderAmountSar}
                onChange={(e) => setOrderAmountSar(Number(e.target.value))}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-customer-id">
                <T>Customer external ID</T>
              </Label>
              <Input
                id="test-customer-id"
                value={customerExternalId}
                onChange={(e) => setCustomerExternalId(e.target.value)}
                placeholder={gt("Required for per-customer limits")}
                className="w-64"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idempotency-key">
                <T>Idempotency key</T>
              </Label>
              <Input
                id="idempotency-key"
                value={redeemKey}
                onChange={(e) => setRedeemKey(e.target.value)}
                placeholder={gt("Optional, replays on duplicate")}
                className="w-64"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => validatePreview.mutate(Math.round(orderAmountSar * 100))}
              disabled={
                validatePreview.isPending ||
                !campaignCurrency ||
                !customerExternalId.trim()
              }
            >
              {validatePreview.isPending ? <T>Validating…</T> : <T>Validate</T>}
            </Button>
            <Button
              type="button"
              onClick={() =>
                redeem.mutate({
                  amount: Math.round(orderAmountSar * 100),
                  idempotencyKey: redeemKey || undefined,
                })
              }
              disabled={
                redeem.isPending ||
                !campaignCurrency ||
                !customerExternalId.trim()
              }
            >
              {redeem.isPending ? <T>Redeeming…</T> : <T>Redeem</T>}
            </Button>
          </div>

          {validatePreview.data ? (
            <pre className="overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
              {JSON.stringify(validatePreview.data, null, 2)}
            </pre>
          ) : null}
          {redeem.data ? (
            <pre className="overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
              {JSON.stringify(redeem.data, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function GiftCardLedger({
  code,
  balance,
  currency,
}: {
  code: string;
  balance: number;
  currency: string | undefined;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["vouchers", "code", code, "transactions"],
    queryFn: () => ovx().vouchers.transactions({ params: { code } }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <T>Gift card ledger</T>
          <span className="text-sm font-normal text-muted-foreground">
            <T>
              Current balance:{" "}
              {currency ? formatMinorCurrency(balance, currency) : (balance / 100).toFixed(2)}
            </T>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            <T>Loading…</T>
          </p>
        ) : !data || data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            <T>No transactions yet.</T>
          </p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {data.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <Badge variant="secondary">{t.reason}</Badge>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="font-mono text-sm">
                  <span className={t.delta < 0 ? "text-red-500" : "text-emerald-500"}>
                    {t.delta > 0 ? "+" : ""}
                    {currency ? formatMinorCurrency(t.delta, currency) : (t.delta / 100).toFixed(2)}
                  </span>
                  <span className="ml-3 text-muted-foreground">
                    →{" "}
                    {currency
                      ? formatMinorCurrency(t.balanceAfter, currency)
                      : (t.balanceAfter / 100).toFixed(2)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

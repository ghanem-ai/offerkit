"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { VoucherForm, type VoucherFormState } from "@/components/dashboard/voucher-form";
import { voucherFormToCreateInput } from "@/lib/forms/voucher";
import { ovx } from "@/lib/sdk";

export default function NewVoucherPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();
  const search = useSearchParams();
  const campaignId = search.get("campaignId") ?? "";

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaigns", campaignId],
    queryFn: () => ovx().campaigns.get({ params: { id: campaignId } }),
    enabled: campaignId !== "",
  });
  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => ovx().workspace.get(),
  });
  const timeZone = campaign?.timezone ?? workspace?.defaultTimezone ?? "UTC";

  const create = useMutation({
    mutationFn: async (state: VoucherFormState) => {
      const input = voucherFormToCreateInput(state, timeZone);
      if (state.customerExternalId) {
        const resolved = await ovx().customers.upsert({
          externalId: state.customerExternalId,
        });
        input.customerId = resolved.customer.id;
      }
      return ovx().vouchers.create(input);
    },
    onSuccess: async (voucher) => {
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(gt("Promotion code created"));
      router.push(`/vouchers/${voucher.code}`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Create failed"));
    },
  });

  if ((campaignId && campaignLoading) || (!campaignId && workspaceLoading)) {
    return (
      <p className="text-sm text-muted-foreground">
        <T>Loading…</T>
      </p>
    );
  }
  if (campaignId && !campaign) {
    return (
      <p className="text-sm text-muted-foreground">
        <T>Campaign not found.</T>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>New promotion code</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Add one fixed-SAR code to this promotion.</T>
        </p>
      </header>
      <VoucherForm
        ghanemOperatorMode
        timeZone={timeZone}
        key={`${campaignId}:${campaign?.type ?? "default"}`}
        mode="create"
        initial={{
          code: "",
          campaignId,
          type: campaign?.type === "GIFT_VOUCHERS" ? "GIFT_CARD" : "DISCOUNT",
          discountKind: "AMOUNT",
          discountValue: 1000,
          maxDiscountAmount: "",
          giftBalance: campaign?.type === "GIFT_VOUCHERS" ? 10000 : "",
          redemptionLimit: "",
          perUserRedemptionLimit: "",
          customerId: "",
          customerExternalId: "",
          priority: 0,
          exclusive: false,
          active: true,
          startDate: "",
          endDate: "",
        }}
        submitLabel={gt("Create promotion code")}
        pending={create.isPending}
        onSubmit={(state) => create.mutate(state)}
      />
    </div>
  );
}

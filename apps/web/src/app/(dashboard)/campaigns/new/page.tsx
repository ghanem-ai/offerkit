"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import {
  PromotionForm,
  type PromotionCreateInput,
} from "@/components/dashboard/promotion-form";
import { ovx } from "@/lib/sdk";

export default function NewCampaignPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();

  const create = useMutation({
    mutationFn: (input: PromotionCreateInput) =>
      ovx().campaigns.createPromotion(input),
    onSuccess: async ({ campaign, voucher }) => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(gt("Promotion created"));
      router.push(`/vouchers/${voucher.code}?campaignId=${campaign.id}`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Create failed"));
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>New promotion</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Create one active fixed-SAR reward code in a single step.</T>
        </p>
      </header>
      <PromotionForm
        timezone="Asia/Riyadh"
        pending={create.isPending}
        onSubmit={(input) => create.mutate(input)}
      />
    </div>
  );
}

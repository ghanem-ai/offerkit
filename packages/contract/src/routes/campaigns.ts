import { oc } from "@orpc/contract";
import { z } from "zod";
import { mcpMeta } from "../mcp.ts";
import {
  campaignCreateInput,
  campaignName,
  campaignOutput,
  campaignStatus,
  campaignType,
  campaignUpdateInput,
  timezoneName,
} from "../schemas/campaign.ts";
import { voucherCreateInput, voucherOutput } from "../schemas/voucher.ts";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";

export const campaigns = {
  list: oc
    .meta(mcpMeta({ expose: true, riskLevel: "safe" }))
    .route({ method: "GET", path: "/campaigns", summary: "List campaigns" })
    .input(
      paginationInput.extend({
        search: z.string().optional(),
        type: campaignType.optional(),
      }),
    )
    .output(paginatedOutput(campaignOutput)),
  get: oc
    .meta(mcpMeta({ expose: true, riskLevel: "safe" }))
    .route({
      method: "GET",
      path: "/campaigns/{id}",
      summary: "Get campaign",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(campaignOutput),
  create: oc
    .route({ method: "POST", path: "/campaigns", summary: "Create campaign" })
    .input(campaignCreateInput)
    .output(campaignOutput),
  createPromotion: oc
    .route({
      method: "POST",
      path: "/promotions",
      summary: "Create a fixed-value promotion and its redeemable code atomically",
    })
    .input(
      z
        .object({
          name: campaignName,
          description: z.string().max(500).optional(),
          code: z
            .string()
            .max(100)
            .refine((value) => value.trim().length > 0, "Code cannot be blank")
            .optional(),
          amount: z.number().int().min(1),
          status: campaignStatus.optional(),
          timezone: timezoneName.optional(),
          startDate: z.string().datetime().optional(),
          endDate: z.string().datetime().optional(),
          redemptionLimit: voucherCreateInput.shape.redemptionLimit,
          perUserRedemptionLimit: voucherCreateInput.shape.perUserRedemptionLimit,
        })
        .refine(
          ({ startDate, endDate }) =>
            !startDate || !endDate || new Date(endDate) >= new Date(startDate),
          {
            path: ["endDate"],
            message: "End date must be after the start date",
          },
        ),
    )
    .output(
      z.object({
        campaign: campaignOutput,
        voucher: voucherOutput,
      }),
    ),
  update: oc
    .route({
      method: "PATCH",
      path: "/campaigns/{id}",
      summary: "Update campaign",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ patch: campaignUpdateInput }) }))
    .output(campaignOutput),
  delete: oc
    .route({
      method: "DELETE",
      path: "/campaigns/{id}",
      summary: "Soft-delete campaign",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(z.object({ ok: z.literal(true) })),
};

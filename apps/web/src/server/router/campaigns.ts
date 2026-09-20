import { ORPCError, implement } from "@orpc/server";
import { and, eq, ilike, isNull } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { contract } from "@offerkit/contract/router";
import { generateUniqueCodes } from "@offerkit/core/codes";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import {
  decodeCursor,
  paginatedSoftDeleteList,
  softDeleteById,
  toCampaign,
  toVoucher,
  type CampaignRow,
} from "./helpers";

const os = implement(contract).$context<RequestContext>();

function toDateOrNull(value: string | undefined | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

const list = os.campaigns.list
  .use(requireSession)
  .handler(({ input }) => {
    const search = input.search?.trim();
    return paginatedSoftDeleteList<CampaignRow, ReturnType<typeof toCampaign>>({
      table: schema.campaign,
      limit: input.limit,
      cursor: decodeCursor(input.cursor),
      filters: [
        ...(search ? [ilike(schema.campaign.name, `%${search}%`)] : []),
        ...(input.type ? [eq(schema.campaign.type, input.type)] : []),
      ],
      toOutput: toCampaign,
    });
  });

const get = os.campaigns.get
  .use(requireSession)
  .handler(async ({ input }) => {
    const row = await db().query.campaign.findFirst({
      where: and(eq(schema.campaign.id, input.params.id), isNull(schema.campaign.deletedAt)),
    });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
    return toCampaign(row);
  });

const create = os.campaigns.create
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .insert(schema.campaign)
      .values({
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        currency: input.currency,
        timezone: input.timezone ?? "UTC",
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        codeConfig: input.codeConfig ?? {},
        validationRuleId: input.validationRuleId ?? null,
        perUserRedemptionLimit: input.perUserRedemptionLimit ?? null,
        autoApply: input.autoApply ?? false,
        metadata: input.metadata ?? {},
      })
      .returning();
    if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
    return toCampaign(row);
  });

async function promotionCodeExists(code: string): Promise<boolean> {
  const row = await db().query.voucher.findFirst({
    where: and(eq(schema.voucher.code, code), isNull(schema.voucher.deletedAt)),
    columns: { id: true },
  });
  return row !== undefined;
}

async function generatePromotionCode(): Promise<string> {
  const codes = await generateUniqueCodes(
    1,
    {
      length: 8,
      charset: "uppercase",
      excludeConfusable: true,
    },
    promotionCodeExists,
  );
  const code = codes[0];
  if (!code) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Promotion code generation failed",
    });
  }
  return code;
}

const createPromotion = os.campaigns.createPromotion
  .use(requireSession)
  .handler(async ({ input }) => {
    const requestedCode = input.code?.trim().toUpperCase();
    const code = requestedCode || (await generatePromotionCode());
    if (requestedCode && (await promotionCodeExists(requestedCode))) {
      throw new ORPCError("CONFLICT", { message: "Promotion code already exists" });
    }

    const result = await db().transaction(async (tx) => {
      const [campaign] = await tx
        .insert(schema.campaign)
        .values({
          name: input.name.trim(),
          description: input.description?.trim() || null,
          type: "DISCOUNT",
          status: input.status ?? "active",
          currency: "SAR",
          timezone: input.timezone ?? "Asia/Riyadh",
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          codeConfig: {
            length: 8,
            charset: "uppercase",
            excludeConfusable: true,
          },
          perUserRedemptionLimit: input.perUserRedemptionLimit ?? 1,
          voucherCount: 1,
          metadata: { surface: "ghanem_promotion" },
        })
        .returning();
      if (!campaign) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Promotion insert failed",
        });
      }

      const [voucher] = await tx
        .insert(schema.voucher)
        .values({
          code,
          campaignId: campaign.id,
          type: "DISCOUNT",
          discount: { type: "AMOUNT", amount: input.amount },
          redemptionLimit: input.redemptionLimit ?? null,
          perUserRedemptionLimit: input.perUserRedemptionLimit ?? 1,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          metadata: { type: "promo" },
        })
        .returning();
      if (!voucher) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Promotion code insert failed",
        });
      }

      return { campaign, voucher };
    });

    return {
      campaign: toCampaign(result.campaign),
      voucher: toVoucher(result.voucher),
    };
  });

const update = os.campaigns.update
  .use(requireSession)
  .handler(async ({ input }) => {
    const patch: Partial<typeof schema.campaign.$inferInsert> = { updatedAt: new Date() };
    const { patch: inputPatch } = input.body;
    if (inputPatch.name !== undefined) patch.name = inputPatch.name;
    if (inputPatch.description !== undefined)
      patch.description = inputPatch.description ?? null;
    if (inputPatch.status !== undefined) patch.status = inputPatch.status;
    if (inputPatch.currency !== undefined) patch.currency = inputPatch.currency;
    if (inputPatch.timezone !== undefined) patch.timezone = inputPatch.timezone;
    if (inputPatch.startDate !== undefined) {
      const v = toDateOrNull(inputPatch.startDate);
      if (v !== undefined) patch.startDate = v;
    }
    if (inputPatch.endDate !== undefined) {
      const v = toDateOrNull(inputPatch.endDate);
      if (v !== undefined) patch.endDate = v;
    }
    if (inputPatch.codeConfig !== undefined) patch.codeConfig = inputPatch.codeConfig;
    if (inputPatch.validationRuleId !== undefined)
      patch.validationRuleId = inputPatch.validationRuleId ?? null;
    if (inputPatch.perUserRedemptionLimit !== undefined) {
      patch.perUserRedemptionLimit = inputPatch.perUserRedemptionLimit ?? null;
    }
    if (inputPatch.autoApply !== undefined) patch.autoApply = inputPatch.autoApply;
    if (inputPatch.metadata !== undefined) patch.metadata = inputPatch.metadata;

    const [row] = await db()
      .update(schema.campaign)
      .set(patch)
      .where(and(eq(schema.campaign.id, input.params.id), isNull(schema.campaign.deletedAt)))
      .returning();
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
    return toCampaign(row);
  });

const remove = os.campaigns.delete
  .use(requireSession)
  .handler(async ({ input }) => {
    await softDeleteById(schema.campaign, input.params.id, "Campaign not found");
    return { ok: true as const };
  });

export const campaignsRouter = {
  list,
  get,
  create,
  createPromotion,
  update,
  delete: remove,
};

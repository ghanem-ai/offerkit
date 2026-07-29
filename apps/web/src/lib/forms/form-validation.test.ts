import { describe, expect, it } from "vitest";
import {
  campaignFormSchema,
  campaignFormToCreateInput,
  campaignFormToUpdateInput,
  type CampaignFormState,
} from "./campaign";
import {
  voucherCreateFormSchema,
  voucherEditFormSchema,
  voucherFormSchema,
  voucherFormToCreateInput,
  voucherFormToUpdateInput,
  type VoucherFormState,
} from "./voucher";
import { fromIsoToLocalDateTime, toIsoOrUndefined } from "./shared";

const campaign: CampaignFormState = {
  name: "Summer sale",
  description: "Internal description",
  type: "DISCOUNT",
  status: "draft",
  currency: "USD",
  timezone: "UTC",
  startDate: "2026-07-10T10:00",
  endDate: "2026-07-11T10:00",
  perUserRedemptionLimit: 2,
  autoApply: true,
  codeLength: 8,
  codePrefix: "SUMMER-",
};

const voucher: VoucherFormState = {
  code: "SUMMER10",
  campaignId: "11111111-1111-4111-8111-111111111111",
  type: "DISCOUNT",
  discountKind: "AMOUNT",
  discountValue: 1_000,
  maxDiscountAmount: "",
  giftBalance: "",
  redemptionLimit: 100,
  perUserRedemptionLimit: 1,
  customerId: "22222222-2222-4222-8222-222222222222",
  customerExternalId: "",
  priority: 3,
  exclusive: true,
  active: true,
  startDate: "2026-07-10T10:00",
  endDate: "2026-07-11T10:00",
};

function issuePaths(result: { error?: { issues: Array<{ path: PropertyKey[] }> } }): string[] {
  return result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
}

describe("campaign form validation", () => {
  it("uses contract limits and form-only date validation", () => {
    const result = campaignFormSchema.safeParse({
      ...campaign,
      name: "   ",
      currency: "US",
      perUserRedemptionLimit: 0,
      codeLength: 33,
      codePrefix: "x".repeat(21),
      startDate: "not-a-date",
    });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(
      expect.arrayContaining([
        "name",
        "currency",
        "perUserRedemptionLimit",
        "codeLength",
        "codePrefix",
        "startDate",
      ]),
    );
  });

  it("rejects an end date before the start date", () => {
    const result = campaignFormSchema.safeParse({
      ...campaign,
      endDate: "2026-07-09T10:00",
    });

    expect(issuePaths(result)).toContain("endDate");
  });

  it("transforms create and edit values to contract payloads", () => {
    const create = campaignFormToCreateInput(campaign);
    expect(create).toMatchObject({
      name: campaign.name,
      type: "DISCOUNT",
      currency: "USD",
      perUserRedemptionLimit: 2,
      codeConfig: { length: 8, prefix: "SUMMER-" },
    });
    expect(create.startDate).toBe("2026-07-10T10:00:00.000Z");
    expect(create.endDate).toBe("2026-07-11T10:00:00.000Z");

    const update = campaignFormToUpdateInput({
      ...campaign,
      status: "active",
      description: "",
      startDate: "",
      endDate: "",
      perUserRedemptionLimit: "",
      codePrefix: "",
    });
    expect(update).toMatchObject({
      name: campaign.name,
      status: "active",
      currency: "USD",
      autoApply: true,
      codeConfig: { length: 8 },
    });
    expect(update).not.toHaveProperty("type");
    expect(update.description).toBeUndefined();
    expect(update.startDate).toBeUndefined();
    expect(update.perUserRedemptionLimit).toBeUndefined();
  });
});

describe("voucher form validation", () => {
  it("validates identifiers, limits, percentages, and dates", () => {
    const result = voucherCreateFormSchema.safeParse({
      ...voucher,
      campaignId: "not-a-uuid",
      customerId: "also-not-a-uuid",
      discountKind: "PERCENTAGE",
      discountValue: 10_001,
      redemptionLimit: 0,
      startDate: "2026-07-12T10:00",
      endDate: "2026-07-11T10:00",
    });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(
      expect.arrayContaining([
        "campaignId",
        "customerId",
        "discountValue",
        "redemptionLimit",
        "endDate",
      ]),
    );
  });

  it("rejects simultaneous internal and external customer identifiers", () => {
    const result = voucherCreateFormSchema.safeParse({
      ...voucher,
      customerExternalId: "ghanem-user-123",
    });

    expect(issuePaths(result)).toContain("customerExternalId");
  });

  it("requires a positive balance only when creating a gift card", () => {
    const giftCard = {
      ...voucher,
      type: "GIFT_CARD" as const,
      giftBalance: "" as const,
    };

    expect(issuePaths(voucherCreateFormSchema.safeParse(giftCard))).toContain(
      "giftBalance",
    );
    expect(voucherEditFormSchema.safeParse(giftCard).success).toBe(true);
  });

  it("transforms discount create values to the nested contract shape", () => {
    const input = voucherFormToCreateInput({
      ...voucher,
      discountKind: "PERCENTAGE",
      discountValue: 2_000,
      maxDiscountAmount: 5_000,
    });

    expect(input).toMatchObject({
      code: "SUMMER10",
      campaignId: voucher.campaignId,
      type: "DISCOUNT",
      discount: {
        type: "PERCENTAGE",
        percent: 2_000,
        maxDiscountAmount: 5_000,
      },
      priority: 3,
      exclusive: true,
      redemptionLimit: 100,
      perUserRedemptionLimit: 1,
      customerId: voucher.customerId,
    });
    expect(input.discount).not.toHaveProperty("amount");
    expect(input.startDate).toBe(new Date(voucher.startDate).toISOString());
  });

  it("preserves gift-card edit behavior while omitting discount fields", () => {
    const input = voucherFormToUpdateInput({
      ...voucher,
      type: "GIFT_CARD",
      giftBalance: "",
      active: false,
    });

    expect(input).toMatchObject({ giftBalance: 0, active: false });
    expect(input).not.toHaveProperty("discount");
    expect(input).not.toHaveProperty("priority");
    expect(input).not.toHaveProperty("exclusive");
    expect(input).not.toHaveProperty("code");
    expect(input).not.toHaveProperty("campaignId");
    expect(input).not.toHaveProperty("type");
  });
});

describe("timezone-aware date conversion", () => {
  it("flags a local time that does not exist in the campaign timezone", () => {
    const result = campaignFormSchema.safeParse({
      ...campaign,
      timezone: "America/New_York",
      startDate: "2026-03-08T02:30",
      endDate: "2026-03-08T04:30",
    });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("startDate");
  });

  it("flags a DST gap on the voucher form using the campaign timezone", () => {
    const result = voucherFormSchema("create", "America/New_York").safeParse({
      ...voucher,
      startDate: "2026-03-08T02:30",
      endDate: "2026-03-08T04:30",
    });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("startDate");
  });

  it("converts Riyadh local time to UTC and back without shifting the form value", () => {
    const iso = toIsoOrUndefined("2026-07-29T10:30", "Asia/Riyadh");

    expect(iso).toBe("2026-07-29T07:30:00.000Z");
    expect(fromIsoToLocalDateTime(iso, "Asia/Riyadh")).toBe("2026-07-29T10:30");
  });

  it("uses the campaign timezone in campaign payloads", () => {
    const input = campaignFormToCreateInput({
      ...campaign,
      timezone: "Asia/Riyadh",
      startDate: "2026-07-29T10:30",
      endDate: "2026-07-29T11:30",
    });

    expect(input.startDate).toBe("2026-07-29T07:30:00.000Z");
    expect(input.endDate).toBe("2026-07-29T08:30:00.000Z");
  });
});

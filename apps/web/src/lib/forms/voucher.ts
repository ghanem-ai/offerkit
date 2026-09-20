import { z } from "zod";
import {
  voucherApp,
  voucherCreateInput,
  voucherDiscount,
  voucherType,
  voucherUpdateInput,
} from "@offerkit/contract";
import { optionalLocalDateTime, toIsoOrUndefined, validateDateRange } from "./shared";

const emptyOrCode = z.union([z.literal(""), voucherCreateInput.shape.code.unwrap()]);
const emptyOrCampaignId = z.union([
  z.literal(""),
  voucherCreateInput.shape.campaignId.unwrap(),
]);
const emptyOrGiftBalance = z.union([
  z.literal(""),
  voucherCreateInput.shape.giftBalance.unwrap(),
]);
const emptyOrRedemptionLimit = z.union([
  z.literal(""),
  voucherCreateInput.shape.redemptionLimit.unwrap(),
]);
const emptyOrPerUserLimit = z.union([
  z.literal(""),
  voucherCreateInput.shape.perUserRedemptionLimit.unwrap(),
]);
const emptyOrCustomerId = z.union([
  z.literal(""),
  voucherCreateInput.shape.customerId.unwrap(),
]);
const emptyOrCustomerExternalId = z.union([
  z.literal(""),
  z.string().min(1).max(256),
]);
const emptyOrMaxDiscount = z.union([
  z.literal(""),
  voucherDiscount.shape.maxDiscountAmount.unwrap(),
]);

/** Empty means "inherit from the campaign"; required by the form when no campaign is attached. */
const emptyOrApp = z.union([z.literal(""), voucherApp]);

const voucherFormFields = z.object({
  code: emptyOrCode,
  campaignId: emptyOrCampaignId,
  app: emptyOrApp,
  type: voucherType,
  discountKind: voucherDiscount.shape.type,
  discountValue: z.number().int().min(0),
  maxDiscountAmount: emptyOrMaxDiscount,
  giftBalance: emptyOrGiftBalance,
  redemptionLimit: emptyOrRedemptionLimit,
  perUserRedemptionLimit: emptyOrPerUserLimit,
  customerId: emptyOrCustomerId,
  customerExternalId: emptyOrCustomerExternalId,
  priority: voucherCreateInput.shape.priority.unwrap(),
  exclusive: z.boolean(),
  active: z.boolean(),
  startDate: optionalLocalDateTime,
  endDate: optionalLocalDateTime,
});

function withVoucherRules(mode: "create" | "edit", timeZone?: string) {
  return voucherFormFields.superRefine((value, context) => {
    validateDateRange(value, context, timeZone);

    if (mode === "create" && !value.campaignId && !value.app) {
      context.addIssue({
        code: "custom",
        path: ["app"],
        message: "Select the app this code belongs to, or attach it to a promotion",
      });
    }

    if (value.customerId && value.customerExternalId) {
      context.addIssue({
        code: "custom",
        path: ["customerExternalId"],
        message: "Use either an external customer ID or an OfferKit customer ID, not both",
      });
    }

    if (value.type === "DISCOUNT") {
      if (value.discountValue < 1) {
        context.addIssue({
          code: "custom",
          path: ["discountValue"],
          message: "Discount must be at least 0.01",
        });
      }
      if (value.discountKind === "PERCENTAGE" && value.discountValue > 10_000) {
        context.addIssue({
          code: "custom",
          path: ["discountValue"],
          message: "Percentage cannot exceed 100%",
        });
      }
    }

    if (
      mode === "create" &&
      value.type === "GIFT_CARD" &&
      (value.giftBalance === "" || value.giftBalance < 1)
    ) {
      context.addIssue({
        code: "custom",
        path: ["giftBalance"],
        message: "Gift card balance must be at least 1",
      });
    }
  });
}

export function voucherFormSchema(mode: "create" | "edit", timeZone?: string) {
  return withVoucherRules(mode, timeZone);
}

export const voucherCreateFormSchema = withVoucherRules("create");
export const voucherEditFormSchema = withVoucherRules("edit");

export type VoucherFormState = z.infer<typeof voucherFormFields>;
export type VoucherCreateInput = z.infer<typeof voucherCreateInput>;
export type VoucherUpdateInput = z.infer<typeof voucherUpdateInput>;

function commonVoucherInput(state: VoucherFormState, timeZone?: string) {
  return {
    ...(state.type === "GIFT_CARD"
      ? {
          giftBalance: state.giftBalance === "" ? 0 : state.giftBalance,
        }
      : {
          discount: {
            type: state.discountKind,
            ...(state.discountKind === "AMOUNT"
              ? { amount: state.discountValue }
              : { percent: state.discountValue }),
            ...(state.maxDiscountAmount === ""
              ? {}
              : { maxDiscountAmount: state.maxDiscountAmount }),
          },
          priority: state.priority,
          exclusive: state.exclusive,
        }),
    redemptionLimit: state.redemptionLimit === "" ? undefined : state.redemptionLimit,
    perUserRedemptionLimit:
      state.perUserRedemptionLimit === "" ? undefined : state.perUserRedemptionLimit,
    customerId: state.customerId || undefined,
    startDate: toIsoOrUndefined(state.startDate, timeZone),
    endDate: toIsoOrUndefined(state.endDate, timeZone),
  };
}

export function voucherFormToCreateInput(
  state: VoucherFormState,
  timeZone?: string,
): VoucherCreateInput {
  return voucherCreateInput.parse({
    ...commonVoucherInput(state, timeZone),
    code: state.code || undefined,
    campaignId: state.campaignId || undefined,
    type: state.type,
    // Omitted when a campaign is attached: the server inherits the campaign's app.
    metadata: state.app ? { app: state.app } : undefined,
  });
}

export function voucherFormToUpdateInput(
  state: VoucherFormState,
  timeZone?: string,
): VoucherUpdateInput {
  return voucherUpdateInput.parse({
    ...commonVoucherInput(state, timeZone),
    active: state.active,
  });
}

import { z } from "zod";
import {
  campaignCreateInput,
  campaignName,
  campaignStatus,
  campaignType,
  campaignUpdateInput,
  codeConfig,
} from "@offerkit/contract";
import { optionalLocalDateTime, toIsoOrUndefined, validateDateRange } from "./shared";

export const campaignFormSchema = z
  .object({
    name: campaignName,
    description: campaignCreateInput.shape.description.unwrap(),
    type: campaignType,
    status: campaignStatus,
    currency: campaignCreateInput.shape.currency,
    timezone: campaignCreateInput.shape.timezone.unwrap(),
    startDate: optionalLocalDateTime,
    endDate: optionalLocalDateTime,
    perUserRedemptionLimit: z.union([
      z.literal(""),
      campaignCreateInput.shape.perUserRedemptionLimit.unwrap(),
    ]),
    autoApply: z.boolean(),
    codeLength: codeConfig.shape.length.unwrap(),
    codePrefix: codeConfig.shape.prefix.unwrap(),
  })
  .superRefine(validateDateRange);

export type CampaignFormState = z.infer<typeof campaignFormSchema>;
export type CampaignCreateInput = z.infer<typeof campaignCreateInput>;
export type CampaignUpdateInput = z.infer<typeof campaignUpdateInput>;

function commonCampaignInput(state: CampaignFormState) {
  return {
    name: state.name,
    description: state.description || undefined,
    currency: state.currency,
    timezone: state.timezone || undefined,
    startDate: toIsoOrUndefined(state.startDate, state.timezone),
    endDate: toIsoOrUndefined(state.endDate, state.timezone),
    perUserRedemptionLimit:
      state.perUserRedemptionLimit === "" ? undefined : state.perUserRedemptionLimit,
    autoApply: state.autoApply,
    codeConfig: {
      length: state.codeLength,
      prefix: state.codePrefix || undefined,
    },
  };
}

/**
 * `app` is passed explicitly rather than held in form state: the campaign form only edits existing
 * campaigns, and a campaign's owning app is set once at creation and changed deliberately.
 */
export function campaignFormToCreateInput(
  state: CampaignFormState,
  app: CampaignCreateInput["app"],
): CampaignCreateInput {
  return campaignCreateInput.parse({
    ...commonCampaignInput(state),
    type: state.type,
    app,
  });
}

export function campaignFormToUpdateInput(state: CampaignFormState): CampaignUpdateInput {
  return campaignUpdateInput.parse({
    ...commonCampaignInput(state),
    status: state.status,
  });
}

import type { ReviewCampaignStatusDto } from "@bayes-platform/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/** Where a review campaign stands, as the app names it: being prepared, open, or over. */
export const CAMPAIGN_STATUS_LABELS = {
  draft: msg({ message: "Draft", comment: "A review campaign being prepared" }),
  active: msg({
    message: "Active",
    comment: "A review campaign open to its testers and reviewers",
  }),
  closed: msg({ message: "Closed", comment: "A review campaign that is over" }),
} as const satisfies Record<ReviewCampaignStatusDto, MessageDescriptor>

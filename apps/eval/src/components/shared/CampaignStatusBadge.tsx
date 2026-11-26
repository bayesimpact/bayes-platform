import type { ReviewCampaignStatusDto } from "@bayes-platform/eval-contracts"
import { useLingui } from "@lingui/react/macro"
import { Badge } from "@/components/ui/badge"
import { CAMPAIGN_STATUS_LABELS } from "@/lib/campaign-status"

export type CampaignStatusBadgeProps = {
  status: ReviewCampaignStatusDto
}

const VARIANTS = {
  draft: "outline",
  active: "default",
  closed: "secondary",
} as const satisfies Record<ReviewCampaignStatusDto, "default" | "secondary" | "outline">

/** Where a review campaign stands: being prepared, open, or over. */
export function CampaignStatusBadge({ status }: CampaignStatusBadgeProps) {
  const { i18n } = useLingui()
  return <Badge variant={VARIANTS[status]}>{i18n._(CAMPAIGN_STATUS_LABELS[status])}</Badge>
}

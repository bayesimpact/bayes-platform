import type { ReviewCampaignRoleDto } from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"

export type CampaignRoleLabelProps = {
  campaignRole: ReviewCampaignRoleDto
}

/** The name of a campaign role, as people read it. */
export function CampaignRoleLabel({ campaignRole }: CampaignRoleLabelProps) {
  switch (campaignRole) {
    case "tester":
      return <Trans comment="A person who tests the agent in a review campaign">Tester</Trans>
    case "reviewer":
      return <Trans comment="A person who reviews the testers' sessions">Reviewer</Trans>
    default:
      return campaignRole satisfies never
  }
}

import { Trans } from "@lingui/react/macro"
import { MegaphoneIcon } from "lucide-react"
import type { ReactNode } from "react"
import { StatusPage } from "@/components/shared/StatusPage"

export type CampaignsEmptyStateProps = {
  /** The way to a first campaign, when the person may create one. */
  action?: ReactNode
}

/** What the list says before the agent has a review campaign. */
export function CampaignsEmptyState({ action }: CampaignsEmptyStateProps) {
  return (
    <StatusPage
      icon={<MegaphoneIcon aria-hidden />}
      title={<Trans>No review campaign yet</Trans>}
      description={
        <Trans>Create a campaign so testers and reviewers can evaluate this agent.</Trans>
      }
      action={action}
    />
  )
}

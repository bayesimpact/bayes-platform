import { Trans } from "@lingui/react/macro"
import { TimeAgo } from "./TimeAgo"

export type CampaignDescriptionProps = {
  description: string | null
  /** When the campaign was created, in epoch milliseconds; none when the page does not know. */
  createdAt?: number
}

/**
 * What a campaign is for, then how long ago it was created, with the full date and time on
 * hover: the description of its page's header.
 */
export function CampaignDescription({ description, createdAt }: CampaignDescriptionProps) {
  return (
    <>
      {description}
      {createdAt === undefined ? null : (
        <span className="block text-sm">
          <Trans comment="When a review campaign was created, such as: Created 5 days ago">
            Created <TimeAgo moment={createdAt} />
          </Trans>
        </span>
      )}
    </>
  )
}

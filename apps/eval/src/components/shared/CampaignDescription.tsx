import { Trans, useLingui } from "@lingui/react/macro"
import { fullDateOf } from "@/lib/format-time"

export type CampaignDescriptionProps = {
  description: string | null
  /** When the campaign was created, in epoch milliseconds; none when the page does not know. */
  createdAt?: number
}

/** What a campaign is for, then the day it was created: the description of its page's header. */
export function CampaignDescription({ description, createdAt }: CampaignDescriptionProps) {
  const { i18n } = useLingui()
  const createdOn = createdAt === undefined ? null : fullDateOf(createdAt, i18n.locale)
  return (
    <>
      {description}
      {createdOn ? (
        <span className="block text-sm">
          <Trans comment="When a review campaign was created, such as: Created Nov 19, 2026">
            Created {createdOn}
          </Trans>
        </span>
      ) : null}
    </>
  )
}

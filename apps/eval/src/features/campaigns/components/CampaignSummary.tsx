import type { ReviewCampaignDetailOutputDto } from "@bayes-platform/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { StatCard } from "@/components/shared/StatCard"
import { meanRatingOf } from "@/lib/format-rating"

export type CampaignSummaryProps = {
  aggregates: ReviewCampaignDetailOutputDto["aggregates"]
}

/** The first figures of a closed campaign; the report has the rest. */
export function CampaignSummary({ aggregates }: CampaignSummaryProps) {
  const { i18n } = useLingui()
  if (!aggregates) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
        <Trans>The summary shows once the campaign is closed.</Trans>
      </p>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        label={<Trans>Mean tester rating</Trans>}
        value={meanRatingOf(aggregates.meanTesterRating, i18n.locale)}
        hint={<Trans>The mean of the ratings testers gave their sessions.</Trans>}
      />
      <StatCard
        label={<Trans comment="How many sessions testers started in a campaign">Sessions</Trans>}
        value={i18n.number(aggregates.sessionCount)}
        hint={<Trans>The sessions testers started.</Trans>}
      />
      <StatCard
        label={<Trans>Final surveys</Trans>}
        value={i18n.number(aggregates.surveyCount)}
        hint={<Trans>The testers who filled the final survey.</Trans>}
      />
    </div>
  )
}

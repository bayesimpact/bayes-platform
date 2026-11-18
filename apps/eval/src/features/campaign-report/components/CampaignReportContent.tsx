import type {
  CampaignReportDistributionOutputDto,
  ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { SectionCard } from "@/components/shared/SectionCard"
import { StatCard } from "@/components/shared/StatCard"
import { meanRatingOf } from "@/lib/format-rating"
import { campaignReportQueryOptions } from "../api/queries"
import { QuestionDistribution } from "./QuestionDistribution"
import { ReportSessionsTable } from "./ReportSessionsTable"

export type CampaignReportContentProps = {
  campaign: ReviewCampaignParamsDto
}

/**
 * The report of a campaign: its headline figures, how the answers to each question spread, and
 * each session's tester rating against its reviewers'. Its download is `DownloadReportButton`.
 */
export function CampaignReportContent({ campaign }: CampaignReportContentProps) {
  const { i18n } = useLingui()
  const { data: report } = useSuspenseQuery(campaignReportQueryOptions(campaign))
  const { headline } = report
  const testerCount = headline.participantCount
  const feedbackCount = headline.testerFeedbackCount
  const reviewCount = headline.reviewerReviewCount
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={<Trans comment="How many sessions testers started in a campaign">Sessions</Trans>}
          value={i18n.number(headline.sessionCount)}
          hint={<Plural value={testerCount} one="# tester" other="# testers" />}
        />
        <StatCard
          label={<Trans>Mean tester rating</Trans>}
          value={meanRatingOf(headline.meanTesterRating, i18n.locale)}
          hint={
            <Plural value={feedbackCount} one="# session feedback" other="# session feedbacks" />
          }
        />
        <StatCard
          label={<Trans>Mean reviewer rating</Trans>}
          value={meanRatingOf(headline.meanReviewerRating, i18n.locale)}
          hint={<Plural value={reviewCount} one="# review" other="# reviews" />}
        />
        <StatCard
          label={<Trans>Mean final rating</Trans>}
          value={meanRatingOf(headline.meanEndOfPhaseRating, i18n.locale)}
          hint={<Trans>From the testers' final surveys.</Trans>}
        />
      </div>
      <Distributions
        title={<Trans>Testers, after each session</Trans>}
        description={<Trans>One answer per session a tester gave feedback on.</Trans>}
        distributions={report.testerPerSessionDistributions}
      />
      <Distributions
        title={<Trans>Testers, at the end</Trans>}
        description={<Trans>One answer per tester who filled the final survey.</Trans>}
        distributions={report.testerEndOfPhaseDistributions}
      />
      <Distributions
        title={<Trans>Reviewers</Trans>}
        description={<Trans>One answer per review, across all sessions.</Trans>}
        distributions={report.reviewerDistributions}
      />
      <SectionCard
        title={<Trans>Sessions</Trans>}
        description={
          <Trans>
            Each session's tester rating against its reviewers'. The spread is the highest reviewer
            rating minus the lowest: a high one means the reviewers disagree.
          </Trans>
        }
      >
        <ReportSessionsTable sessions={report.sessionMatrix} />
      </SectionCard>
    </div>
  )
}

type DistributionsProps = {
  title: ReactNode
  description: ReactNode
  distributions: CampaignReportDistributionOutputDto[]
}

/** The questions of one list with how their answers spread; nothing when the list is empty. */
function Distributions({ title, description, distributions }: DistributionsProps) {
  if (distributions.length === 0) return null
  return (
    <SectionCard title={title} description={description}>
      <div className="grid gap-3 lg:grid-cols-2">
        {distributions.map((distribution) => (
          <QuestionDistribution key={distribution.questionId} distribution={distribution} />
        ))}
      </div>
    </SectionCard>
  )
}

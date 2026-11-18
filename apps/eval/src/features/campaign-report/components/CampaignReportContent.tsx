import type {
  CampaignReportDistributionOutputDto,
  ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { StatCard } from "@/components/shared/StatCard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { meanRatingOf } from "@/lib/format-rating"
import { campaignReportQueryOptions } from "../api/queries"
import { QuestionDistribution } from "./QuestionDistribution"
import { ReportSessionsTable } from "./ReportSessionsTable"

export type CampaignReportContentProps = {
  campaign: ReviewCampaignParamsDto
}

/**
 * The report of a campaign: its headline figures, then one tab per form with how the answers to
 * each of its questions spread, and one with each session's tester rating against its reviewers'.
 * Its download is `DownloadReportButton`.
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
      <Tabs defaultValue="session">
        <TabsList variant="line" className="max-w-full overflow-x-auto">
          <TabsTrigger value="session">
            <Trans>After each session</Trans>
          </TabsTrigger>
          <TabsTrigger value="final">
            <Trans>Final survey</Trans>
          </TabsTrigger>
          <TabsTrigger value="review">
            <Trans>Session review</Trans>
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Trans comment="The report's tab with each session's ratings">Sessions</Trans>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="session" className="pt-4">
          <Distributions
            description={<Trans>One answer per session a tester gave feedback on.</Trans>}
            distributions={report.testerPerSessionDistributions}
          />
        </TabsContent>
        <TabsContent value="final" className="pt-4">
          <Distributions
            description={<Trans>One answer per tester who filled the final survey.</Trans>}
            distributions={report.testerEndOfPhaseDistributions}
          />
        </TabsContent>
        <TabsContent value="review" className="pt-4">
          <Distributions
            description={<Trans>One answer per review, across all sessions.</Trans>}
            distributions={report.reviewerDistributions}
          />
        </TabsContent>
        <TabsContent value="sessions" className="flex flex-col gap-3 pt-4">
          <p className="text-muted-foreground">
            <Trans>
              Each session's tester rating against its reviewers'. The spread is the highest
              reviewer rating minus the lowest: a high one means the reviewers disagree.
            </Trans>
          </p>
          <ReportSessionsTable sessions={report.sessionMatrix} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

type DistributionsProps = {
  description: ReactNode
  distributions: CampaignReportDistributionOutputDto[]
}

/** The questions of one form with how their answers spread, or a word when it has none. */
function Distributions({ description, distributions }: DistributionsProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">{description}</p>
      {distributions.length === 0 ? (
        <p className="text-muted-foreground italic">
          <Trans>This form asks no question.</Trans>
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {distributions.map((distribution) => (
            <QuestionDistribution key={distribution.questionId} distribution={distribution} />
          ))}
        </div>
      )}
    </div>
  )
}

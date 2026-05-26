import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import {
  campaignReportFactory,
  campaignReportHeadlineFactory,
  campaignReportQuestionDistributionFactory,
  campaignReportSessionRowFactory,
} from "@/studio/features/review-campaigns/reports/report.factory"
import type { CampaignReport } from "@/studio/features/review-campaigns/reports/reports.models"
import type { IReportsSpi } from "@/studio/features/review-campaigns/reports/reports.spi"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withReportData?: boolean
}

const FIXED_CAMPAIGN_ID = "campaign-report-fixture"

function buildPopulatedReport(): CampaignReport {
  return campaignReportFactory.build({
    campaignId: FIXED_CAMPAIGN_ID,
    headline: campaignReportHeadlineFactory.build({
      sessionCount: 24,
      testerFeedbackCount: 18,
      reviewerReviewCount: 9,
      meanTesterRating: 4.1,
      meanReviewerRating: 3.7,
      meanEndOfPhaseRating: 4.3,
      participantCount: 5,
    }),
    testerPerSessionDistributions: [
      campaignReportQuestionDistributionFactory.build({
        questionId: "q-helpful",
        prompt: "Was the response helpful?",
        type: "rating",
        responseCount: 18,
        buckets: [
          { label: "1", count: 1 },
          { label: "2", count: 1 },
          { label: "3", count: 4 },
          { label: "4", count: 7 },
          { label: "5", count: 5 },
        ],
      }),
    ],
    testerEndOfPhaseDistributions: [
      campaignReportQuestionDistributionFactory.build({
        questionId: "q-overall",
        prompt: "Overall, how satisfied were you?",
        type: "rating",
        responseCount: 5,
        buckets: [
          { label: "3", count: 1 },
          { label: "4", count: 2 },
          { label: "5", count: 2 },
        ],
      }),
    ],
    reviewerDistributions: [
      campaignReportQuestionDistributionFactory.build({
        questionId: "q-accurate",
        prompt: "Was the answer factually correct?",
        type: "single-choice",
        responseCount: 9,
        buckets: [
          { label: "Yes", count: 6 },
          { label: "Partial", count: 2 },
          { label: "No", count: 1 },
        ],
      }),
    ],
    sessionMatrix: [
      campaignReportSessionRowFactory.build({
        sessionType: "conversation",
        testerRating: 4,
        reviewerRatings: [4, 3],
        reviewerCount: 2,
        meanReviewerRating: 3.5,
        reviewerRatingSpread: 1,
      }),
      campaignReportSessionRowFactory.build({
        sessionType: "form",
        testerRating: 5,
        reviewerRatings: [5],
        reviewerCount: 1,
        meanReviewerRating: 5,
        reviewerRatingSpread: 0,
      }),
    ],
  })
}

function buildMockReportsService(overrides: { report?: CampaignReport } = {}): IReportsSpi {
  return {
    async getReport() {
      return overrides.report ?? campaignReportFactory.build({ campaignId: FIXED_CAMPAIGN_ID })
    },
    async getReportCsv() {
      return new Blob([""], { type: "text/csv" })
    },
  }
}

const meta = {
  title: "routes/studio/project/review-campaign-report",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withReportData: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withReportData: false,
  },
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.reviewCampaignReport.path,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withReportData, ...args }) => {
      const { baseSeeds } = buildStudioData(args)
      const report = withReportData
        ? buildPopulatedReport()
        : campaignReportFactory.build({ campaignId: FIXED_CAMPAIGN_ID })
      return {
        state: mergeSeeds(
          baseSeeds,
          seed.currentReviewCampaignId(FIXED_CAMPAIGN_ID),
          seed.campaignReport(report),
        ),
        services: {
          reviewCampaignsReports: buildMockReportsService({ report }),
        },
      }
    }),
  ],
}

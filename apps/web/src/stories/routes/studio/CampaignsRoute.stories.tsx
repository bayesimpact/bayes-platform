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
import { reviewCampaignFactory } from "@/studio/features/review-campaigns/review-campaign.factory"
import type {
  ReviewCampaign,
  ReviewCampaignListItem,
} from "@/studio/features/review-campaigns/review-campaigns.models"
import type { IReviewCampaignsSpi } from "@/studio/features/review-campaigns/review-campaigns.spi"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

// CampaignsRoute renders three URLs: the list of campaigns, an open campaign
// (the editor, in a full-screen sheet over the list) and that campaign's report.

type StoryArgs = StudioStoryArgs & {
  withCampaigns?: boolean
  withReportData?: boolean
}

const FIXED_CAMPAIGN_ID = "campaign-report-fixture"

type StudioData = ReturnType<typeof buildStudioData>

function toListItem(campaign: ReviewCampaign, memberCount: number): ReviewCampaignListItem {
  return { ...campaign, memberCount }
}

function buildCampaigns({ project, agents }: StudioData): ReviewCampaignListItem[] {
  return [
    toListItem(
      reviewCampaignFactory.transient({ project, agent: agents[0] }).build({ status: "draft" }),
      0,
    ),
    toListItem(
      reviewCampaignFactory.transient({ project, agent: agents[1] }).build({ status: "active" }),
      4,
    ),
    toListItem(
      reviewCampaignFactory
        .transient({ project, agent: agents[2] })
        .build({ id: FIXED_CAMPAIGN_ID, status: "closed" }),
      6,
    ),
  ]
}

const CLOSED_CAMPAIGN_AGGREGATES = { meanTesterRating: 4.1, sessionCount: 24, surveyCount: 5 }

function buildMockReviewCampaignsService(
  overrides: { campaigns?: ReviewCampaignListItem[] } = {},
): IReviewCampaignsSpi {
  const campaigns = overrides.campaigns ?? []
  return {
    async getAll() {
      return campaigns
    },
    async getOne({ reviewCampaignId }) {
      const campaign = campaigns.find((entry) => entry.id === reviewCampaignId) ?? campaigns[0]
      if (!campaign) throw new Error("No campaign available in mock service")
      return {
        ...campaign,
        memberships: [],
        aggregates: campaign.status === "closed" ? CLOSED_CAMPAIGN_AGGREGATES : null,
      }
    },
    async createOne(_params, payload) {
      throw new Error(`createOne not implemented in mock service (${payload.name})`)
    },
    async updateOne(_params, payload) {
      throw new Error(`updateOne not implemented in mock service (${payload.name ?? ""})`)
    },
    async deleteOne() {},
    async revokeMembership() {},
  }
}

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
        agentType: "conversation",
        testerRating: 4,
        reviewerRatings: [4, 3],
        reviewerCount: 2,
        meanReviewerRating: 3.5,
        reviewerRatingSpread: 1,
      }),
      campaignReportSessionRowFactory.build({
        agentType: "conversation",
        testerRating: 5,
        reviewerRatings: [5],
        reviewerCount: 1,
        meanReviewerRating: 5,
        reviewerRatingSpread: 0,
      }),
    ],
  })
}

function buildMockReportsService(report: CampaignReport): IReportsSpi {
  return {
    async getReport() {
      return report
    },
    async getReportCsv() {
      return new Blob([""], { type: "text/csv" })
    },
  }
}

const meta = {
  title: "routes/studio/project/review-campaigns",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    withCampaigns: { control: "boolean" },
    withReportData: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    withCampaigns: false,
    withReportData: false,
  },
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.reviewCampaigns.path,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

const listDecorator = buildDecorator<StoryArgs>(({ withCampaigns, ...args }) => {
  const studioData = buildStudioData(args)
  const campaigns = withCampaigns ? buildCampaigns(studioData) : []
  return {
    state: mergeSeeds(studioData.baseSeeds, seed.studio.reviewCampaigns(campaigns)),
    services: { reviewCampaigns: buildMockReviewCampaignsService({ campaigns }) },
  }
})

export const Default: Story = {
  decorators: [listDecorator],
}

export const WithData: Story = {
  args: { withCampaigns: true },
  decorators: [listDecorator],
}

// An open closed campaign: its editor shows the summary with the "View full report" button.
export const Editor: Story = {
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.reviewCampaign.path,
  }),
  decorators: [
    buildDecorator<StoryArgs>(({ withCampaigns: _withCampaigns, ...args }) => {
      const studioData = buildStudioData(args)
      const campaigns = buildCampaigns(studioData)
      const closedCampaign = campaigns.find((campaign) => campaign.id === FIXED_CAMPAIGN_ID)
      if (!closedCampaign) throw new Error("The closed campaign fixture is missing")
      return {
        state: mergeSeeds(
          studioData.baseSeeds,
          seed.currentReviewCampaignId(FIXED_CAMPAIGN_ID),
          seed.studio.reviewCampaigns(campaigns),
          seed.studio.selectedReviewCampaignDetail({
            ...closedCampaign,
            memberships: [],
            aggregates: CLOSED_CAMPAIGN_AGGREGATES,
          }),
        ),
        services: { reviewCampaigns: buildMockReviewCampaignsService({ campaigns }) },
      }
    }),
  ],
}

// The report of a closed campaign, in the editor's sheet: its back arrow returns to the editor.
export const Report: Story = {
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.reviewCampaignReport.path,
  }),
  decorators: [
    buildDecorator<StoryArgs>(({ withCampaigns: _withCampaigns, withReportData, ...args }) => {
      const studioData = buildStudioData(args)
      const campaigns = buildCampaigns(studioData)
      const report = withReportData
        ? buildPopulatedReport()
        : campaignReportFactory.build({ campaignId: FIXED_CAMPAIGN_ID })
      return {
        state: mergeSeeds(
          studioData.baseSeeds,
          seed.currentReviewCampaignId(FIXED_CAMPAIGN_ID),
          seed.studio.reviewCampaigns(campaigns),
          seed.campaignReport(report),
        ),
        services: {
          reviewCampaigns: buildMockReviewCampaignsService({ campaigns }),
          reviewCampaignsReports: buildMockReportsService(report),
        },
      }
    }),
  ],
}

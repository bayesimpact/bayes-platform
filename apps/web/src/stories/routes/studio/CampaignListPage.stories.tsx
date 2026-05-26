import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { reviewCampaignFactory } from "@/studio/features/review-campaigns/review-campaign.factory"
import type {
  ReviewCampaign,
  ReviewCampaignListItem,
} from "@/studio/features/review-campaigns/review-campaigns.models"
import type { IReviewCampaignsSpi } from "@/studio/features/review-campaigns/review-campaigns.spi"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withCampaigns?: boolean
}

function toListItem(campaign: ReviewCampaign, memberCount: number): ReviewCampaignListItem {
  return { ...campaign, memberCount }
}

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
      return { ...campaign, memberships: [], aggregates: null }
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

const meta = {
  title: "routes/studio/project/review-campaigns",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    withCampaigns: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    withCampaigns: false,
  },
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.reviewCampaigns.path,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withCampaigns, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const campaigns: ReviewCampaignListItem[] = withCampaigns
        ? [
            toListItem(
              reviewCampaignFactory
                .transient({ project, agent: agents[0] })
                .build({ status: "draft" }),
              0,
            ),
            toListItem(
              reviewCampaignFactory
                .transient({ project, agent: agents[1] })
                .build({ status: "active" }),
              4,
            ),
            toListItem(
              reviewCampaignFactory
                .transient({ project, agent: agents[2] })
                .build({ status: "closed" }),
              6,
            ),
          ]
        : []
      return {
        state: mergeSeeds(baseSeeds, seed.studio.reviewCampaigns(campaigns)),
        services: {
          reviewCampaigns: buildMockReviewCampaignsService({ campaigns }),
        },
      }
    }),
  ],
}

export const WithData: Story = {
  args: {
    organizationMembershipRole: "owner",
    projectMembershipRole: "owner",
    agentMembershipRole: "owner",
    featureFlags: [],
    withAgents: true,
    withCampaigns: true,
  },

  decorators: [
    buildDecorator<StoryArgs>(({ withCampaigns, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const campaigns: ReviewCampaignListItem[] = withCampaigns
        ? [
            toListItem(
              reviewCampaignFactory
                .transient({
                  project,
                  agent: agents[0],
                })
                .build({
                  status: "draft",
                }),
              0,
            ),
            toListItem(
              reviewCampaignFactory
                .transient({
                  project,
                  agent: agents[1],
                })
                .build({
                  status: "active",
                }),
              4,
            ),
            toListItem(
              reviewCampaignFactory
                .transient({
                  project,
                  agent: agents[2],
                })
                .build({
                  status: "closed",
                }),
              6,
            ),
          ]
        : []
      return {
        state: mergeSeeds(baseSeeds, seed.studio.reviewCampaigns(campaigns)),

        services: {
          reviewCampaigns: buildMockReviewCampaignsService({
            campaigns,
          }),
        },
      }
    }),
  ],
}

import type { ReviewCampaignDto, ReviewCampaignMembershipDto } from "@caseai-connect/api-contracts"
import type { IReviewCampaignsSpi } from "@/studio/features/review-campaigns/review-campaigns.spi"
import {
  mockActiveCampaign,
  mockClosedCampaign,
  mockDraftCampaign,
  mockMemberships,
} from "./fixtures"

const now = () => Date.now()

type Overrides = {
  campaigns?: ReviewCampaignDto[]
  memberships?: ReviewCampaignMembershipDto[]
}

export function buildMockReviewCampaignsService(overrides: Overrides = {}): IReviewCampaignsSpi {
  const campaigns = overrides.campaigns ?? [
    mockDraftCampaign,
    mockActiveCampaign,
    mockClosedCampaign,
  ]
  const memberships = overrides.memberships ?? mockMemberships

  return {
    async getAll() {
      return campaigns.map((campaign) => ({
        ...campaign,
        memberCount: campaign.status !== "draft" ? memberships.length : 0,
      }))
    },
    async getOne({ reviewCampaignId }) {
      const campaign = campaigns.find((c) => c.id === reviewCampaignId) ?? campaigns[0]
      if (!campaign) throw new Error("No campaigns in mock service")
      return {
        ...campaign,
        memberships: campaign.status !== "draft" ? memberships : [],
        aggregates:
          campaign.status === "closed"
            ? { meanTesterRating: 4.2, surveyCount: 3, sessionCount: 7 }
            : null,
      }
    },
    async createOne(_params, payload) {
      return {
        ...mockDraftCampaign,
        id: `campaign-new-${now()}`,
        name: payload.name,
        description: payload.description ?? null,
        agentId: payload.agentId,
        testerPerSessionQuestions: payload.testerPerSessionQuestions ?? [],
        testerEndOfPhaseQuestions: payload.testerEndOfPhaseQuestions ?? [],
        reviewerQuestions: payload.reviewerQuestions ?? [],
        status: "draft",
        activatedAt: null,
        closedAt: null,
        createdAt: now(),
        updatedAt: now(),
      }
    },
    async updateOne({ reviewCampaignId }, payload) {
      const campaign = campaigns.find((c) => c.id === reviewCampaignId) ?? mockDraftCampaign
      return {
        ...campaign,
        name: payload.name ?? campaign.name,
        description: payload.description ?? campaign.description,
        status: payload.status ?? campaign.status,
        updatedAt: now(),
      }
    },
    async deleteOne() {
      return
    },
    async revokeMembership() {
      return
    },
  }
}

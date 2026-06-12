import type {
  ListMyReviewCampaignsResponseDto,
  MyTesterSessionSummaryDto,
  ReviewCampaignTesterContextDto,
  TesterCampaignSurveyDto,
} from "@caseai-connect/api-contracts"
import type { ITesterSpi } from "@/tester/features/review-campaigns/tester.spi"
import { mockMyCampaigns, mockTesterContext } from "./fixtures"

const now = () => Date.now()

type Overrides = {
  myCampaigns?: ListMyReviewCampaignsResponseDto["reviewCampaigns"]
  testerContext?: ReviewCampaignTesterContextDto
  myTesterSessions?: MyTesterSessionSummaryDto[]
  myTesterSurvey?: TesterCampaignSurveyDto | null
}

export function buildMockTesterService(overrides: Overrides = {}): ITesterSpi {
  const myCampaigns = overrides.myCampaigns ?? mockMyCampaigns
  const testerContext = overrides.testerContext ?? mockTesterContext
  const myTesterSessions = overrides.myTesterSessions ?? []
  const myTesterSurvey = overrides.myTesterSurvey ?? null
  return {
    async listMyCampaigns() {
      return myCampaigns
    },
    async getTesterContext() {
      return testerContext
    },
    async listMyTesterSessions() {
      return myTesterSessions
    },
    async getMyTesterSurvey() {
      return myTesterSurvey
    },
    async deleteSession() {},
    async startSession() {
      return { id: `session-${now()}`, agentType: "conversation" }
    },
    async submitFeedback({ sessionId }, payload) {
      return {
        id: `feedback-${now()}`,
        campaignId: mockTesterContext.id,
        sessionId,
        agentType: "conversation",
        overallRating: payload.overallRating,
        comment: payload.comment ?? null,
        answers: payload.answers ?? [],
        createdAt: now(),
        updatedAt: now(),
      }
    },
    async updateFeedback({ sessionId }, payload) {
      return {
        id: `feedback-${now()}`,
        campaignId: mockTesterContext.id,
        sessionId,
        agentType: "conversation",
        overallRating: payload.overallRating ?? 5,
        comment: payload.comment ?? null,
        answers: payload.answers ?? [],
        createdAt: now(),
        updatedAt: now(),
      }
    },
    async submitSurvey({ reviewCampaignId }, payload) {
      return {
        id: `survey-${now()}`,
        campaignId: reviewCampaignId,
        userId: "user-mock",
        overallRating: payload.overallRating,
        comment: payload.comment ?? null,
        answers: payload.answers ?? [],
        submittedAt: now(),
        createdAt: now(),
        updatedAt: now(),
      }
    },
    async updateSurvey({ reviewCampaignId }, payload) {
      return {
        id: `survey-${now()}`,
        campaignId: reviewCampaignId,
        userId: "user-mock",
        overallRating: payload.overallRating ?? 5,
        comment: payload.comment ?? null,
        answers: payload.answers ?? [],
        submittedAt: now(),
        createdAt: now(),
        updatedAt: now(),
      }
    },
  }
}

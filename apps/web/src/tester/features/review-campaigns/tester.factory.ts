import type {
  ListMyReviewCampaignsResponseDto,
  MyTesterSessionSummaryDto,
  ReviewCampaignQuestionDto,
  ReviewCampaignTesterContextDto,
  ReviewCampaignTesterFeedbackAnswerDto,
  TesterAgentSnapshotDto,
  TesterCampaignSurveyDto,
  TesterSessionFeedbackDto,
} from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"

const AGENT_NAMES = [
  "Helpful Assistant",
  "Research Agent",
  "Drafting Helper",
  "Summary Bot",
  "Triage Assistant",
  "Support Agent",
]

class TesterAgentSnapshotFactory extends Factory<TesterAgentSnapshotDto> {}

export const testerAgentSnapshotFactory = TesterAgentSnapshotFactory.define(({ params }) => ({
  id: params.id ?? faker.string.uuid(),
  name: params.name ?? faker.helpers.arrayElement(AGENT_NAMES),
  type: params.type ?? "conversation",
  greetingMessage: params.greetingMessage ?? null,
}))

type TesterContextTransientParams = {
  agent?: TesterAgentSnapshotDto
  perSessionQuestions?: ReviewCampaignQuestionDto[]
  endOfPhaseQuestions?: ReviewCampaignQuestionDto[]
}

class TesterContextFactory extends Factory<
  ReviewCampaignTesterContextDto,
  TesterContextTransientParams
> {}

export const testerContextFactory = TesterContextFactory.define(
  ({ params, transientParams }): ReviewCampaignTesterContextDto => ({
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? faker.commerce.productName(),
    description: params.description ?? faker.lorem.sentence(),
    status: params.status ?? "active",
    agent: transientParams.agent ?? testerAgentSnapshotFactory.build(),
    testerPerSessionQuestions: transientParams.perSessionQuestions ?? [],
    testerEndOfPhaseQuestions: transientParams.endOfPhaseQuestions ?? [],
  }),
)

type MyReviewCampaignTransientParams = {
  project: Project
  agent?: { id: string }
}

type MyReviewCampaign = ListMyReviewCampaignsResponseDto["reviewCampaigns"][number]

class MyReviewCampaignFactory extends Factory<MyReviewCampaign, MyReviewCampaignTransientParams> {}

export const myReviewCampaignFactory = MyReviewCampaignFactory.define(
  ({ params, transientParams }) => {
    const { project, agent } = transientParams
    if (!project) {
      throw new Error("Project must be provided in transient params to build a MyReviewCampaign")
    }
    return {
      id: params.id ?? faker.string.uuid(),
      name: params.name ?? faker.commerce.productName(),
      description: params.description ?? faker.lorem.sentence(),
      status: params.status ?? "active",
      agentId: params.agentId ?? agent?.id ?? faker.string.uuid(),
      createdAt: params.createdAt ?? faker.date.recent().getTime(),
      organizationId: project.organizationId,
      projectId: project.id,
    }
  },
)

type SurveyTransientParams = {
  campaign: { id: string }
  user?: { id: string }
  answers?: ReviewCampaignTesterFeedbackAnswerDto[]
}

class TesterCampaignSurveyFactory extends Factory<TesterCampaignSurveyDto, SurveyTransientParams> {}

export const testerCampaignSurveyFactory = TesterCampaignSurveyFactory.define(
  ({ params, transientParams }) => {
    const { campaign, user, answers } = transientParams
    if (!campaign) {
      throw new Error(
        "Campaign must be provided in transient params to build a TesterCampaignSurvey",
      )
    }
    const time = params.submittedAt ?? faker.date.recent().getTime()
    return {
      id: params.id ?? faker.string.uuid(),
      campaignId: campaign.id,
      userId: params.userId ?? user?.id ?? faker.string.uuid(),
      overallRating: params.overallRating ?? 4,
      comment: params.comment ?? null,
      answers: params.answers ?? answers ?? [],
      submittedAt: time,
      createdAt: params.createdAt ?? time,
      updatedAt: params.updatedAt ?? time,
    }
  },
)

class MyTesterSessionSummaryFactory extends Factory<MyTesterSessionSummaryDto> {}

export const myTesterSessionSummaryFactory = MyTesterSessionSummaryFactory.define(({ params }) => ({
  sessionId: params.sessionId ?? faker.string.uuid(),
  sessionType: params.sessionType ?? "conversation",
  startedAt: params.startedAt ?? faker.date.recent().getTime(),
  feedbackStatus: params.feedbackStatus ?? "pending",
}))

type FeedbackTransientParams = {
  campaign: { id: string }
  session?: { id: string; type?: "conversation" | "extraction" | "form" }
  answers?: ReviewCampaignTesterFeedbackAnswerDto[]
}

class TesterSessionFeedbackFactory extends Factory<
  TesterSessionFeedbackDto,
  FeedbackTransientParams
> {}

export const testerSessionFeedbackFactory = TesterSessionFeedbackFactory.define(
  ({ params, transientParams }) => {
    const { campaign, session, answers } = transientParams
    if (!campaign) {
      throw new Error(
        "Campaign must be provided in transient params to build a TesterSessionFeedback",
      )
    }
    const time = faker.date.recent().getTime()
    return {
      id: params.id ?? faker.string.uuid(),
      campaignId: campaign.id,
      sessionId: params.sessionId ?? session?.id ?? faker.string.uuid(),
      sessionType: params.sessionType ?? session?.type ?? "conversation",
      overallRating: params.overallRating ?? 4,
      comment: params.comment ?? null,
      answers: params.answers ?? answers ?? [],
      createdAt: params.createdAt ?? time,
      updatedAt: params.updatedAt ?? time,
    }
  },
)

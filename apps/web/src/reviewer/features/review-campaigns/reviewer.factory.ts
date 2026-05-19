import type {
  ReviewCampaignQuestionDto,
  ReviewCampaignTesterFeedbackAnswerDto,
  ReviewerAgentSnapshotDto,
  ReviewerFormResultDto,
  ReviewerSessionBlindDto,
  ReviewerSessionFullDto,
  ReviewerSessionListItemDto,
  ReviewerSessionReviewDto,
  ReviewerSessionTranscriptMessageDto,
} from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"

const AGENT_NAMES = [
  "Helpful Assistant",
  "Research Agent",
  "Drafting Helper",
  "Summary Bot",
  "Triage Assistant",
  "Support Agent",
]

class ReviewerAgentSnapshotFactory extends Factory<ReviewerAgentSnapshotDto> {}

export const reviewerAgentSnapshotFactory = ReviewerAgentSnapshotFactory.define(({ params }) => ({
  id: params.id ?? faker.string.uuid(),
  name: params.name ?? faker.helpers.arrayElement(AGENT_NAMES),
  type: params.type ?? "conversation",
}))

class ReviewerSessionTranscriptMessageFactory extends Factory<ReviewerSessionTranscriptMessageDto> {}

export const reviewerSessionTranscriptMessageFactory =
  ReviewerSessionTranscriptMessageFactory.define(({ params }) => ({
    id: params.id ?? faker.string.uuid(),
    role: params.role ?? "user",
    content: params.content ?? faker.lorem.sentence(),
    createdAt: params.createdAt ?? faker.date.recent().getTime(),
  }))

type ReviewerSessionReviewTransientParams = {
  campaign: { id: string }
  session?: { id: string; type?: "conversation" | "extraction" | "form" }
  user?: { id: string }
  answers?: ReviewCampaignTesterFeedbackAnswerDto[]
}

class ReviewerSessionReviewFactory extends Factory<
  ReviewerSessionReviewDto,
  ReviewerSessionReviewTransientParams
> {}

export const reviewerSessionReviewFactory = ReviewerSessionReviewFactory.define(
  ({ params, transientParams }) => {
    const { campaign, session, user, answers } = transientParams
    if (!campaign) {
      throw new Error(
        "Campaign must be provided in transient params to build a ReviewerSessionReview",
      )
    }
    const time = params.submittedAt ?? faker.date.recent().getTime()
    return {
      id: params.id ?? faker.string.uuid(),
      campaignId: campaign.id,
      sessionId: params.sessionId ?? session?.id ?? faker.string.uuid(),
      sessionType: params.sessionType ?? session?.type ?? "conversation",
      reviewerUserId: params.reviewerUserId ?? user?.id ?? faker.string.uuid(),
      overallRating: params.overallRating ?? 4,
      comment: params.comment ?? null,
      answers: params.answers ?? answers ?? [],
      submittedAt: time,
      createdAt: params.createdAt ?? time,
      updatedAt: params.updatedAt ?? time,
    }
  },
)

class ReviewerSessionListItemFactory extends Factory<ReviewerSessionListItemDto> {}

export const reviewerSessionListItemFactory = ReviewerSessionListItemFactory.define(
  ({ params }) => ({
    sessionId: params.sessionId ?? faker.string.uuid(),
    sessionType: params.sessionType ?? "conversation",
    testerUserId: params.testerUserId ?? faker.string.uuid(),
    startedAt: params.startedAt ?? faker.date.recent().getTime(),
    messageCount: params.messageCount ?? 0,
    reviewerCount: params.reviewerCount ?? 0,
    callerHasReviewed: params.callerHasReviewed ?? false,
    callerIsSessionOwner: params.callerIsSessionOwner ?? false,
  }),
)

type ReviewerSessionTransientParams = {
  agent?: ReviewerAgentSnapshotDto
  transcript?: ReviewerSessionTranscriptMessageDto[]
  reviewerQuestions?: ReviewCampaignQuestionDto[]
  formResult?: ReviewerFormResultDto | null
}

class ReviewerSessionBlindFactory extends Factory<
  ReviewerSessionBlindDto,
  ReviewerSessionTransientParams & {
    factualTesterQuestions?: ReviewCampaignQuestionDto[]
    factualTesterAnswers?: ReviewCampaignTesterFeedbackAnswerDto[]
  }
> {}

export const reviewerSessionBlindFactory = ReviewerSessionBlindFactory.define(
  ({ params, transientParams }): ReviewerSessionBlindDto => ({
    sessionId: params.sessionId ?? faker.string.uuid(),
    sessionType: params.sessionType ?? "conversation",
    testerUserId: params.testerUserId ?? faker.string.uuid(),
    startedAt: params.startedAt ?? faker.date.recent().getTime(),
    agent: transientParams.agent ?? reviewerAgentSnapshotFactory.build(),
    transcript: transientParams.transcript ?? [],
    reviewerQuestions: transientParams.reviewerQuestions ?? [],
    otherReviewerCount: params.otherReviewerCount ?? 0,
    formResult: transientParams.formResult ?? null,
    blind: true,
    factualTesterQuestions: transientParams.factualTesterQuestions ?? [],
    factualTesterAnswers: transientParams.factualTesterAnswers ?? [],
  }),
)

type ReviewerSessionFullTransientParams = ReviewerSessionTransientParams & {
  campaign?: { id: string }
  testerPerSessionQuestions?: ReviewCampaignQuestionDto[]
  myReview?: ReviewerSessionReviewDto
  otherReviews?: ReviewerSessionReviewDto[]
}

class ReviewerSessionFullFactory extends Factory<
  ReviewerSessionFullDto,
  ReviewerSessionFullTransientParams
> {}

export const reviewerSessionFullFactory = ReviewerSessionFullFactory.define(
  ({ params, transientParams }): ReviewerSessionFullDto => {
    const sessionId = params.sessionId ?? faker.string.uuid()
    const sessionType = params.sessionType ?? "conversation"
    const campaign = transientParams.campaign ?? { id: faker.string.uuid() }
    const myReview =
      transientParams.myReview ??
      reviewerSessionReviewFactory
        .transient({ campaign, session: { id: sessionId, type: sessionType } })
        .build()
    return {
      sessionId,
      sessionType,
      testerUserId: params.testerUserId ?? faker.string.uuid(),
      startedAt: params.startedAt ?? faker.date.recent().getTime(),
      agent: transientParams.agent ?? reviewerAgentSnapshotFactory.build(),
      transcript: transientParams.transcript ?? [],
      reviewerQuestions: transientParams.reviewerQuestions ?? [],
      otherReviewerCount: params.otherReviewerCount ?? 0,
      formResult: transientParams.formResult ?? null,
      blind: false,
      testerPerSessionQuestions: transientParams.testerPerSessionQuestions ?? [],
      testerFeedback: null,
      myReview,
      otherReviews: transientParams.otherReviews ?? [],
    }
  },
)

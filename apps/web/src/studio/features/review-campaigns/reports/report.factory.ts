import type {
  CampaignReportBucketDto,
  CampaignReportDto,
  CampaignReportHeadlineDto,
  CampaignReportQuestionDistributionDto,
  CampaignReportSessionRowDto,
  ReviewCampaignQuestionType,
} from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"

class CampaignReportHeadlineFactory extends Factory<CampaignReportHeadlineDto> {}

export const campaignReportHeadlineFactory = CampaignReportHeadlineFactory.define(({ params }) => ({
  sessionCount: params.sessionCount ?? 0,
  testerFeedbackCount: params.testerFeedbackCount ?? 0,
  reviewerReviewCount: params.reviewerReviewCount ?? 0,
  meanTesterRating: params.meanTesterRating ?? null,
  meanReviewerRating: params.meanReviewerRating ?? null,
  meanEndOfPhaseRating: params.meanEndOfPhaseRating ?? null,
  participantCount: params.participantCount ?? 0,
}))

class CampaignReportBucketFactory extends Factory<CampaignReportBucketDto> {}

export const campaignReportBucketFactory = CampaignReportBucketFactory.define(({ params }) => ({
  label: params.label ?? faker.string.alpha(3),
  count: params.count ?? 0,
}))

type QuestionDistributionTransientParams = {
  type?: ReviewCampaignQuestionType
}

class CampaignReportQuestionDistributionFactory extends Factory<
  CampaignReportQuestionDistributionDto,
  QuestionDistributionTransientParams
> {}

export const campaignReportQuestionDistributionFactory =
  CampaignReportQuestionDistributionFactory.define(({ params, transientParams }) => {
    const type = params.type ?? transientParams.type ?? "rating"
    return {
      questionId: params.questionId ?? faker.string.uuid(),
      prompt: params.prompt ?? faker.lorem.sentence(),
      type,
      responseCount: params.responseCount ?? 0,
      buckets: params.buckets ?? [],
    }
  })

class CampaignReportSessionRowFactory extends Factory<CampaignReportSessionRowDto> {}

export const campaignReportSessionRowFactory = CampaignReportSessionRowFactory.define(
  ({ params }) => ({
    sessionId: params.sessionId ?? faker.string.uuid(),
    agentType: params.agentType ?? "conversation",
    testerUserId: params.testerUserId ?? faker.string.uuid(),
    startedAt: params.startedAt ?? faker.date.recent().getTime(),
    testerRating: params.testerRating ?? null,
    reviewerRatings: params.reviewerRatings ?? [],
    reviewerCount: params.reviewerCount ?? 0,
    meanReviewerRating: params.meanReviewerRating ?? null,
    reviewerRatingSpread: params.reviewerRatingSpread ?? null,
  }),
)

type CampaignReportTransientParams = {
  headline?: CampaignReportHeadlineDto
}

class CampaignReportFactory extends Factory<CampaignReportDto, CampaignReportTransientParams> {}

export const campaignReportFactory = CampaignReportFactory.define(
  ({ params, transientParams }): CampaignReportDto => ({
    campaignId: params.campaignId ?? faker.string.uuid(),
    headline: transientParams.headline ?? campaignReportHeadlineFactory.build(),
    testerPerSessionDistributions: params.testerPerSessionDistributions ?? [],
    testerEndOfPhaseDistributions: params.testerEndOfPhaseDistributions ?? [],
    reviewerDistributions: params.reviewerDistributions ?? [],
    sessionMatrix: params.sessionMatrix ?? [],
  }),
)

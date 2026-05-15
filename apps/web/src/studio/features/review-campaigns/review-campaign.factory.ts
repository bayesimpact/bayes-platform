import type {
  ReviewCampaignDetailDto,
  ReviewCampaignDto,
  ReviewCampaignMembershipDto,
  ReviewCampaignQuestionDto,
  ReviewCampaignQuestionType,
} from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"

type QuestionTransientParams = {
  type?: ReviewCampaignQuestionType
}

class ReviewCampaignQuestionFactory extends Factory<
  ReviewCampaignQuestionDto,
  QuestionTransientParams
> {}

export const reviewCampaignQuestionFactory = ReviewCampaignQuestionFactory.define(
  ({ params, transientParams }) => {
    const type = params.type ?? transientParams.type ?? "rating"
    const base: ReviewCampaignQuestionDto = {
      id: params.id ?? faker.string.uuid(),
      prompt: params.prompt ?? faker.lorem.sentence(),
      type,
      required: params.required ?? true,
    }
    if (params.options !== undefined) base.options = params.options
    else if (type === "single-choice") base.options = ["Yes", "No"]
    if (params.isFactual !== undefined) base.isFactual = params.isFactual
    return base
  },
)

type CampaignTransientParams = {
  project: Project
  agent?: { id: string }
}

class ReviewCampaignFactory extends Factory<ReviewCampaignDto, CampaignTransientParams> {}

export const reviewCampaignFactory = ReviewCampaignFactory.define(({ params, transientParams }) => {
  const { project, agent } = transientParams
  if (!project) {
    throw new Error("Project must be provided in transient params to build a ReviewCampaign")
  }
  return {
    id: params.id ?? faker.string.uuid(),
    organizationId: project.organizationId,
    projectId: project.id,
    agentId: params.agentId ?? agent?.id ?? faker.string.uuid(),
    name: params.name ?? faker.commerce.productName(),
    description: params.description ?? faker.lorem.sentence(),
    status: params.status ?? "draft",
    testerPerSessionQuestions: params.testerPerSessionQuestions ?? [],
    testerEndOfPhaseQuestions: params.testerEndOfPhaseQuestions ?? [],
    reviewerQuestions: params.reviewerQuestions ?? [],
    activatedAt: params.activatedAt ?? null,
    closedAt: params.closedAt ?? null,
    createdAt: params.createdAt ?? faker.date.past().getTime(),
    updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
  }
})

type MembershipTransientParams = {
  campaign: { id: string }
}

class ReviewCampaignMembershipFactory extends Factory<
  ReviewCampaignMembershipDto,
  MembershipTransientParams
> {}

export const reviewCampaignMembershipFactory = ReviewCampaignMembershipFactory.define(
  ({ params, transientParams }) => {
    const { campaign } = transientParams
    if (!campaign) {
      throw new Error(
        "Campaign must be provided in transient params to build a ReviewCampaignMembership",
      )
    }
    return {
      id: params.id ?? faker.string.uuid(),
      campaignId: campaign.id,
      userId: params.userId ?? faker.string.uuid(),
      userEmail: params.userEmail ?? faker.internet.email().toLowerCase(),
      role: params.role ?? "tester",
      invitedAt: params.invitedAt ?? faker.date.past().getTime(),
      acceptedAt: params.acceptedAt ?? null,
    }
  },
)

type DetailTransientParams = CampaignTransientParams & {
  memberships?: ReviewCampaignMembershipDto[]
  aggregates?: ReviewCampaignDetailDto["aggregates"]
}

class ReviewCampaignDetailFactory extends Factory<ReviewCampaignDetailDto, DetailTransientParams> {}

export const reviewCampaignDetailFactory = ReviewCampaignDetailFactory.define(
  ({ params, transientParams }): ReviewCampaignDetailDto => {
    const { project, agent, memberships = [], aggregates = null } = transientParams
    if (!project) {
      throw new Error(
        "Project must be provided in transient params to build a ReviewCampaignDetail",
      )
    }
    const base = reviewCampaignFactory.transient({ project, agent }).build(params)
    return {
      ...base,
      memberships,
      aggregates,
    }
  },
)

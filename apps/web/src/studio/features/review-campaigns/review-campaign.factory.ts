import type {
  ReviewCampaignQuestionDto,
  ReviewCampaignQuestionType,
} from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"

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

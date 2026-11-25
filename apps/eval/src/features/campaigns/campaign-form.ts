import type {
  AgentVersionOutputDto,
  CreateReviewCampaignInputDto,
  ReviewCampaignOutputDto,
  ReviewCampaignQuestionDto,
  ReviewCampaignQuestionInputDto,
} from "@bayes-platform/eval-contracts"
import { type CampaignFormValues, parseOptions, type QuestionFormValues } from "./schemas"

/** A question of a campaign, as the editor's form holds it. */
function questionFormValuesOf(question: ReviewCampaignQuestionDto): QuestionFormValues {
  return {
    id: question.id,
    prompt: question.prompt,
    type: question.type,
    required: question.required,
    isFactual: question.isFactual ?? false,
    optionsText: (question.options ?? []).join(", "),
  }
}

/** A blank question, which the person fills: a rating by default. */
export function blankQuestion(): QuestionFormValues {
  return {
    id: crypto.randomUUID(),
    prompt: "",
    type: "rating",
    required: false,
    isFactual: false,
    optionsText: "",
  }
}

/**
 * The form's values of an existing campaign. A version no longer listed, archived since, counts
 * as no choice: the person chooses again before the campaign goes on.
 */
export function campaignFormValuesOf(
  campaign: ReviewCampaignOutputDto,
  versions: AgentVersionOutputDto[],
): CampaignFormValues {
  const isListed = versions.some((version) => version.id === campaign.agentSettingsId)
  return {
    agentSettingsId: isListed ? campaign.agentSettingsId : "",
    name: campaign.name,
    description: campaign.description ?? "",
    testerPerSessionQuestions: campaign.testerPerSessionQuestions.map(questionFormValuesOf),
    testerEndOfPhaseQuestions: campaign.testerEndOfPhaseQuestions.map(questionFormValuesOf),
    reviewerQuestions: campaign.reviewerQuestions.map(questionFormValuesOf),
  }
}

/**
 * A question as the API takes it: options only for a single choice, and the factual mark only
 * where it means something, on a tester's per-session rating or single choice.
 */
export function questionInputOf(
  question: QuestionFormValues,
  { hasFactual }: { hasFactual: boolean },
): ReviewCampaignQuestionInputDto {
  const isFactual = hasFactual && question.type !== "free-text" && question.isFactual
  return {
    id: question.id,
    prompt: question.prompt,
    type: question.type,
    required: question.required,
    ...(question.type === "single-choice" ? { options: parseOptions(question.optionsText) } : {}),
    ...(isFactual ? { isFactual: true } : {}),
  }
}

/** What the API takes from the form: a blank description is none, and no version keeps the saved one. */
export function campaignConfigInputOf(
  values: CampaignFormValues,
): Omit<CreateReviewCampaignInputDto, "agentId"> {
  return {
    ...(values.agentSettingsId === "" ? {} : { agentSettingsId: values.agentSettingsId }),
    name: values.name,
    description: values.description.trim() === "" ? null : values.description,
    testerPerSessionQuestions: values.testerPerSessionQuestions.map((question) =>
      questionInputOf(question, { hasFactual: true }),
    ),
    testerEndOfPhaseQuestions: values.testerEndOfPhaseQuestions.map((question) =>
      questionInputOf(question, { hasFactual: false }),
    ),
    reviewerQuestions: values.reviewerQuestions.map((question) =>
      questionInputOf(question, { hasFactual: false }),
    ),
  }
}

/** A question of the form as the preview shows it, whatever it still lacks. */
export function previewQuestionOf(question: QuestionFormValues): ReviewCampaignQuestionDto {
  return {
    id: question.id,
    prompt: question.prompt,
    type: question.type,
    required: question.required,
    options: parseOptions(question.optionsText),
  }
}

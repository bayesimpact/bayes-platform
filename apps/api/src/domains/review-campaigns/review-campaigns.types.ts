export type ReviewCampaignStatus = "draft" | "active" | "closed"

export type ReviewCampaignMembershipRole = "tester" | "reviewer"

export type ReviewCampaignAgentType = "conversation" | "form"

export type ReviewCampaignQuestionType = "rating" | "single-choice" | "free-text"

export type ReviewCampaignQuestion = {
  id: string
  prompt: string
  type: ReviewCampaignQuestionType
  required: boolean
  options?: string[]
  /**
   * Tester per-session questions only. When true and the question type is
   * `rating` or `single-choice`, the tester's answer stays visible to reviewers
   * during blind review. See `filterFactualAnswers` in reviewer.service.ts.
   */
  isFactual?: boolean
}

export type ReviewCampaignAnswer = {
  questionId: string
  value: string | number | string[]
}

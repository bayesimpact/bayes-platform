export type ReviewCampaignStatus = "draft" | "active" | "closed"
export type ReviewCampaignMembershipRole = "tester" | "reviewer"
export type ReviewCampaignQuestionType = "rating" | "single-choice" | "free-text"
// Historically also "form"; those rows were migrated to "conversation" when the
// form agent type was replaced by the fillForm tool (issue #558).
export type ReviewCampaignAgentType = "conversation"
export type ReviewCampaignQuestionDto = {
  id: string
  prompt: string
  type: ReviewCampaignQuestionType
  required: boolean
  options?: string[]
  /**
   * Tester per-session questions only. When true and the question type is
   * `rating` or `single-choice`, the tester's answer stays visible to reviewers
   * during blind review (factual: describes what happened). When false/absent,
   * the answer is hidden until the reviewer submits (opinion).
   */
  isFactual?: boolean
}

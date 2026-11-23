import {
  CAMPAIGN_INVITATION_EMAILS_MAX,
  reviewCampaignQuestionTypeSchema,
  reviewCampaignRoleSchema,
} from "@caseai-connect/eval-contracts"
import { z } from "zod"

/** The tabs of a campaign's editor, which the URL holds. */
export const CAMPAIGN_TABS = ["setup", "participants", "summary"] as const

export type CampaignTab = (typeof CAMPAIGN_TABS)[number]

/**
 * The steps that set a campaign up, in order: its name, its three lists of questions, its
 * activation, then its invitations, which open once it is active.
 */
export const SETUP_STEPS = [
  "campaign",
  "session",
  "final",
  "reviewers",
  "activate",
  "invite",
] as const

export type SetupStep = (typeof SETUP_STEPS)[number]

/**
 * The search params of a campaign's editor: the tab it shows, its first one by default, the step
 * of a draft's setup, its first one by default, and
 * whether the preview panel is open beside the setup, which the window's width decides by default.
 */
export const campaignEditorSearchSchema = z.object({
  tab: z.enum(CAMPAIGN_TABS).optional().catch(undefined),
  step: z.enum(SETUP_STEPS).optional().catch(undefined),
  preview: z.boolean().optional().catch(undefined),
})

/** The options of a single-choice question, as the person writes them: one per comma. */
export function parseOptions(text: string): string[] {
  return text
    .split(",")
    .map((option) => option.trim())
    .filter((option) => option !== "")
}

/**
 * A question in the editor. Its options are one text, split at each comma when the form is sent:
 * a single choice needs two of them at least.
 */
const questionFormSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().trim().min(1),
    type: reviewCampaignQuestionTypeSchema,
    required: z.boolean(),
    isFactual: z.boolean(),
    optionsText: z.string(),
  })
  .refine(
    (question) =>
      question.type !== "single-choice" || parseOptions(question.optionsText).length >= 2,
    { path: ["optionsText"] },
  )

export type QuestionFormValues = z.input<typeof questionFormSchema>

/**
 * The form of a campaign's setup: the version of the agent it runs on, its name, what it is for
 * and its three lists of questions.
 */
export const campaignFormSchema = z.object({
  /** The saved version of the agent the campaign runs on: empty while the agent has none. */
  agentSettingsId: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string(),
  testerPerSessionQuestions: z.array(questionFormSchema),
  testerEndOfPhaseQuestions: z.array(questionFormSchema),
  reviewerQuestions: z.array(questionFormSchema),
})

export type CampaignFormValues = z.input<typeof campaignFormSchema>

/** The names of the form's three lists of questions. */
export type QuestionListName =
  | "testerPerSessionQuestions"
  | "testerEndOfPhaseQuestions"
  | "reviewerQuestions"

/** The email addresses a text holds, split at spaces, commas and semicolons. */
export function parseEmails(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email !== ""),
    ),
  ]
}

/** The form that invites people: their addresses in one text, and the role they all get. */
export const inviteParticipantsFormSchema = z.object({
  emailsText: z.string().refine((text) => {
    const emails = parseEmails(text)
    return (
      emails.length > 0 &&
      emails.length <= CAMPAIGN_INVITATION_EMAILS_MAX &&
      emails.every((email) => z.email().safeParse(email).success)
    )
  }),
  role: reviewCampaignRoleSchema,
})

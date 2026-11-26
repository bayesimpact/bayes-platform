import { conversationFormOutputSchema } from "@caseai-connect/chat-contracts"
import { z } from "zod"
import { agentTypeSchema } from "../agents/agents.dto"
import {
  reviewCampaignAnswerSchema,
  reviewCampaignQuestionSchema,
  reviewCampaignStatusSchema,
} from "./review-campaigns.dto"

/**
 * A campaign as its testers and reviewers see it: what it is for, the agent it reviews and the
 * questions it asks its testers.
 */
export const campaignContextOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: reviewCampaignStatusSchema,
  agent: z.object({
    id: z.uuid(),
    name: z.string(),
    type: agentTypeSchema,
    /** What the agent says first in a new session, when it has a greeting. */
    greetingMessage: z.string().optional(),
  }),
  testerPerSessionQuestions: z.array(reviewCampaignQuestionSchema),
  testerEndOfPhaseQuestions: z.array(reviewCampaignQuestionSchema),
})

export type CampaignContextOutputDto = z.output<typeof campaignContextOutputSchema>

/** Whether a tester gave their feedback on a session. */
export const testerFeedbackStatusSchema = z.enum(["submitted", "pending", "abandoned"])

export type TesterFeedbackStatusDto = z.output<typeof testerFeedbackStatusSchema>

/** A session a tester started with the campaign's agent. */
export const testerSessionOutputSchema = z.object({
  id: z.uuid(),
  agentId: z.uuid(),
  feedbackStatus: testerFeedbackStatusSchema,
  createdAt: z.number(),
  /** The forms the agents filled in during the session. */
  forms: z.array(conversationFormOutputSchema),
})

export type TesterSessionOutputDto = z.output<typeof testerSessionOutputSchema>

export const testerSessionsOutputSchema = z.object({
  sessions: z.array(testerSessionOutputSchema),
})

/** A new session takes nothing: the server gives it its campaign and its agent. */
export const startTesterSessionInputSchema = z.strictObject({})

export const startTesterSessionOutputSchema = z.object({ id: z.uuid() })

/** The feedback a tester gave on a session. */
export const testerFeedbackOutputSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  overallRating: z.number(),
  comment: z.string().nullable(),
  answers: z.array(reviewCampaignAnswerSchema),
})

/** The survey a tester fills once, when they finish taking part. */
export const testerSurveyOutputSchema = z.object({
  id: z.uuid(),
  overallRating: z.number(),
  comment: z.string().nullable(),
  answers: z.array(reviewCampaignAnswerSchema),
})

export type TesterSurveyOutputDto = z.output<typeof testerSurveyOutputSchema>

export const myTesterSurveyOutputSchema = z.object({
  survey: testerSurveyOutputSchema.nullable(),
})

/** The params of the routes of a tester's session, which name no campaign: the session has one. */
export const testerSessionParamsSchema = z.strictObject({
  organizationId: z.uuid(),
  projectId: z.uuid(),
  sessionId: z.uuid(),
})

export type TesterSessionParamsDto = z.output<typeof testerSessionParamsSchema>

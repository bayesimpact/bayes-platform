import { z } from "zod"

/** What an agent does: hold a conversation, or extract data from documents. */
export const agentTypeSchema = z.enum(["conversation", "extraction"])

export type AgentTypeDto = z.output<typeof agentTypeSchema>

/**
 * An agent of a project, as `GET organizations/:organizationId/projects/:projectId/agents-with-drafts`
 * returns it: every agent the person can read, a draft never published included, since evaluation
 * runs drafts.
 */
export const projectAgentOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: agentTypeSchema,
  projectId: z.uuid(),
  /** Present once the agent was published: the app reads only whether it is there. */
  currentRevision: z.object({}).optional(),
})

export type ProjectAgentOutputDto = z.output<typeof projectAgentOutputSchema>

/**
 * A version of an agent's settings, as `GET .../agents/:agentId/settings` returns it: the saved
 * versions, newest first, and the draft when there is one. An archived version is not listed.
 */
export const agentVersionOutputSchema = z.object({
  id: z.uuid(),
  revision: z.number(),
  /** The name its author gave it when saving it. */
  name: z.string().nullable(),
  description: z.string().nullable(),
  isDraft: z.boolean(),
  /** The version every live channel runs with: one at most, never the draft. */
  isProduction: z.boolean(),
  /** When it was saved, for a saved version. */
  updatedAt: z.number(),
})

export type AgentVersionOutputDto = z.output<typeof agentVersionOutputSchema>

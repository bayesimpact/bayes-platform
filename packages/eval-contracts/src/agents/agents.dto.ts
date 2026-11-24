import { z } from "zod"

/** What an agent does: hold a conversation, or extract data from documents. */
export const agentTypeSchema = z.enum(["conversation", "extraction"])

export type AgentTypeDto = z.output<typeof agentTypeSchema>

/**
 * An agent of a project, as `GET eval/organizations/:organizationId/projects/:projectId/agents` returns
 * it: every agent the person can read that has a version in production. The first version saved
 * goes to production, so these are the agents with a saved version, which an evaluation or a
 * review campaign can run.
 */
export const projectAgentOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: agentTypeSchema,
  projectId: z.uuid(),
})

export type ProjectAgentOutputDto = z.output<typeof projectAgentOutputSchema>

/** Which documents of its project an agent searches: all of them, none, or those of some tags. */
export const documentsRagModeSchema = z.enum(["all", "none", "tags"])

/**
 * A version of an agent's settings, as `GET eval/.../agents/:agentId/settings` returns it: the saved
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
  // What a version holds, which the history compares from one version to another.
  instructions: z.string(),
  greetingMessage: z.string().optional(),
  model: z.string(),
  providerOptions: z.record(z.string(), z.unknown()),
  documentsRagMode: documentsRagModeSchema,
  outputJsonSchema: z.record(z.string(), z.unknown()).optional(),
  fillFormEnabled: z.boolean(),
  priorityCallsEnabled: z.boolean(),
  /** The defaults of the {{variables}} its instructions declare. */
  variables: z.record(z.string(), z.string()).nullable(),
  embeddingModel: z.string(),
  followUpSuggestionsEnabled: z.boolean(),
  followUpSuggestionsInstructions: z.string().nullable(),
  followUpSuggestionsMax: z.number(),
})

export type AgentVersionOutputDto = z.output<typeof agentVersionOutputSchema>

import { z } from "zod"

/** What an agent does: hold a conversation, or extract data from documents. */
export const agentTypeSchema = z.enum(["conversation", "extraction"])

export type AgentTypeDto = z.output<typeof agentTypeSchema>

/**
 * An agent of a project, as `GET organizations/:organizationId/projects/:projectId/agents` returns
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

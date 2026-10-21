import { z } from "zod"

/** What an agent does: hold a conversation, or extract data from documents. */
export const agentTypeSchema = z.enum(["conversation", "extraction"])

export type AgentTypeDto = z.output<typeof agentTypeSchema>

/**
 * An agent of a project, as `GET organizations/:organizationId/projects/:projectId/agents` returns
 * it: the agents the person is a member of, published at least once, sorted by name.
 */
export const projectAgentOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: agentTypeSchema,
  projectId: z.uuid(),
})

export type ProjectAgentOutputDto = z.output<typeof projectAgentOutputSchema>

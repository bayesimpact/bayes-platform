import { z } from "zod"

/** What an agent does: hold a conversation, or extract data from documents. */
export const agentTypeSchema = z.enum(["conversation", "extraction"])

export type AgentTypeDto = z.output<typeof agentTypeSchema>

/**
 * The permission that opens a live session with an agent of each type: a conversation, or an
 * extraction of documents and CSV files.
 */
export const AGENT_SESSION_CREATE_PERMISSIONS = {
  conversation: "agent.conversation.session.create",
  extraction: "agent.extraction.session.create",
} as const satisfies Record<AgentTypeDto, string>

/**
 * An agent of a project, as `GET organizations/:organizationId/projects/:projectId/agents` returns
 * it: the agents the person can read, published at least once, sorted by name.
 */
export const projectAgentOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: agentTypeSchema,
  projectId: z.uuid(),
  /**
   * The published revision: the Desk reads the greeting a new conversation opens with. The API
   * leaves the key out when the agent has no greeting, as it does for the revision's name.
   */
  currentRevision: z.object({ greetingMessage: z.string().optional() }),
  /**
   * The person's permissions on the agent, among those the API exposes: the Desk reads whether
   * they may open a session with it (`AGENT_SESSION_CREATE_PERMISSIONS`).
   */
  permissions: z.array(z.string()),
})

export type ProjectAgentOutputDto = z.output<typeof projectAgentOutputSchema>

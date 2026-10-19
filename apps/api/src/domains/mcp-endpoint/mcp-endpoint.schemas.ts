import {
  AgentLocale,
  AgentModel,
  agentTypeSchema,
  DEFAULT_AGENT_MODEL,
  outputJsonSchemaSchema,
} from "@caseai-connect/api-contracts"
import { z } from "zod"

/** Input and output of each tool of the platform MCP server: what MCP clients see. */

const mcpProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  canCreateAgents: z.boolean(),
})

const mcpAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: agentTypeSchema,
  model: z.string(),
  canUpdate: z.boolean(),
  studioUrl: z.string().nullable(),
})

const mcpCreatedAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: agentTypeSchema,
  projectId: z.string(),
  organizationId: z.string(),
  studioUrl: z.string().nullable(),
})

const mcpUpdatedAgentSchema = mcpAgentSchema.extend({ draftRevision: z.number() })

export type McpProjectDto = z.infer<typeof mcpProjectSchema>
export type McpAgentDto = z.infer<typeof mcpAgentSchema>
export type McpCreatedAgentDto = z.infer<typeof mcpCreatedAgentSchema>
export type McpUpdatedAgentDto = z.infer<typeof mcpUpdatedAgentSchema>

export const listProjectsOutputSchema = z.object({ projects: z.array(mcpProjectSchema) })

export const createAgentInputSchema = z.object({
  projectId: z.uuid().describe("Id of the project the agent belongs to, from list_projects."),
  name: z.string().trim().min(3).describe("Name of the agent, at least 3 characters."),
  type: agentTypeSchema
    .default("conversation")
    .describe(
      "conversation: the agent chats with users. extraction: the agent reads a document and returns JSON that follows outputJsonSchema.",
    ),
  instructions: z
    .string()
    .min(1)
    .describe("System prompt: what the agent does, its tone and the rules it follows."),
  model: z.enum(AgentModel).default(DEFAULT_AGENT_MODEL).describe("Language model of the agent."),
  locale: z.enum(AgentLocale).default(AgentLocale.EN).describe("Language the agent speaks."),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .default(0)
    .describe("Sampling temperature, from 0 (steady) to 2 (creative)."),
  greetingMessage: z
    .string()
    .max(2000)
    .optional()
    .describe("First message shown to users of a conversation agent."),
  outputJsonSchema: outputJsonSchemaSchema
    .optional()
    .describe("JSON Schema of the result. Required for an extraction agent."),
})

export const createAgentOutputSchema = z.object({ agent: mcpCreatedAgentSchema })

export const listAgentsInputSchema = z.object({
  projectId: z.uuid().describe("Id of the project, from list_projects."),
})

export const listAgentsOutputSchema = z.object({ agents: z.array(mcpAgentSchema) })

export const updateAgentInputSchema = z.object({
  agentId: z.uuid().describe("Id of the agent, from list_agents or create_agent."),
  model: z.enum(AgentModel).optional().describe("New language model of the agent."),
  instructions: z.string().min(1).optional().describe("New system prompt of the agent."),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .optional()
    .describe("New sampling temperature, from 0 (steady) to 2 (creative)."),
  locale: z.enum(AgentLocale).optional().describe("New language of the agent."),
  greetingMessage: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .describe("New first message of a conversation agent, or null to remove it."),
})

export const updateAgentOutputSchema = z.object({ agent: mcpUpdatedAgentSchema })

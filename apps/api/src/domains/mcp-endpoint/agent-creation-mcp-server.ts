import {
  AgentLocale,
  AgentModel,
  agentTypeSchema,
  duplicateAgentSchema,
  outputJsonSchemaSchema,
} from "@caseai-connect/api-contracts"
import { type CallToolResult, McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import { getMcpServerTitle } from "@/config/mcp-server-title"
import { AGENT_DEFAULT_MODELS } from "@/domains/agents/settings/agent-models.service"
import type { McpAgentToolsService, McpCaller } from "./mcp-agent-tools.service"

export const MCP_SERVER_NAME = "agents"
export const MCP_SERVER_VERSION = "1.1.0"

const MCP_SERVER_INSTRUCTIONS = [
  "Creates, updates and duplicates agents on the platform for the signed-in user.",
  "Call list_projects first: an agent always belongs to a project. It lists the projects the user granted to this client, and only the ones with canCreateAgents set to true accept new agents.",
  "Then call create_agent with that project's id. It returns the agent's id and, when the platform knows its public URL, a link to the agent in the studio.",
  "To change an existing agent, call list_agents with the project's id, then update_agent with the agent's id: only the agents with canUpdate set to true can be changed. update_agent edits the draft; the user publishes it in the studio.",
  "To start a variant of an existing agent, call duplicate_agent with the agent's id from list_agents and a new name: only the agents with canDuplicate set to true can be copied. The copy is a new agent of the same project whose settings are a draft (published is false): nothing uses it until the user publishes it in the studio.",
].join(" ")

// Tool outputs are loose objects: their JSON Schema allows properties they do not list, so a
// client that listed the tools before a release that adds a field still accepts the answers.
const projectSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  canCreateAgents: z.boolean(),
})

const createAgentInputSchema = z.object({
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
  model: z
    .enum(AgentModel)
    .default(AGENT_DEFAULT_MODELS.agent)
    .describe("Language model of the agent."),
  locale: z.enum(AgentLocale).default(AgentLocale.EN).describe("Language the agent speaks."),
  greetingMessage: z
    .string()
    .max(2000)
    .optional()
    .describe("First message shown to users of a conversation agent."),
  outputJsonSchema: outputJsonSchemaSchema
    .optional()
    .describe("JSON Schema of the result. Required for an extraction agent."),
})

const createdAgentSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  type: agentTypeSchema,
  projectId: z.string(),
  organizationId: z.string(),
  studioUrl: z.string().nullable(),
})

const agentSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  type: agentTypeSchema,
  model: z.string(),
  published: z.boolean(),
  canUpdate: z.boolean(),
  canDuplicate: z.boolean(),
  studioUrl: z.string().nullable(),
})

const updateAgentInputSchema = z.object({
  agentId: z.uuid().describe("Id of the agent, from list_agents or create_agent."),
  model: z.enum(AgentModel).optional().describe("New language model of the agent."),
  instructions: z.string().min(1).optional().describe("New system prompt of the agent."),
  locale: z.enum(AgentLocale).optional().describe("New language of the agent."),
  greetingMessage: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .describe("New first message of a conversation agent, or null to remove it."),
})

const duplicateAgentInputSchema = z.object({
  agentId: z.uuid().describe("Id of the agent to copy, from list_agents."),
  name: duplicateAgentSchema.shape.name.describe(
    "Name of the copy, at least 3 characters, for example the original's name with a suffix.",
  ),
})

/**
 * One MCP server per request, bound to the person and their grant: the
 * endpoint is stateless, so nothing outlives the HTTP exchange.
 */
export function buildAgentCreationMcpServer({
  caller,
  toolsService,
}: {
  caller: McpCaller
  toolsService: McpAgentToolsService
}): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, title: getMcpServerTitle(), version: MCP_SERVER_VERSION },
    { instructions: MCP_SERVER_INSTRUCTIONS },
  )

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "Lists the projects the user granted to this client, with their organization and whether agents can be created in them.",
      outputSchema: z.looseObject({ projects: z.array(projectSchema) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const projects = await toolsService.listProjects(caller)
      return structuredResult({ projects })
    },
  )

  server.registerTool(
    "create_agent",
    {
      title: "Create agent",
      description:
        "Creates an agent in a project and publishes its first version. Documents, tags and other settings are edited afterwards in the studio.",
      inputSchema: createAgentInputSchema,
      outputSchema: z.looseObject({ agent: createdAgentSchema }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await toolsService.createAgent(caller, input)
      if (!result.ok) {
        return { isError: true, content: [{ type: "text", text: result.error }] }
      }
      return structuredResult({ agent: result.agent })
    },
  )

  server.registerTool(
    "list_agents",
    {
      title: "List agents",
      description:
        "Lists the agents of a project the user is a member of, with their model, whether they are published, and whether update_agent can change them and duplicate_agent can copy them.",
      inputSchema: z.object({
        projectId: z.uuid().describe("Id of the project, from list_projects."),
      }),
      outputSchema: z.looseObject({ agents: z.array(agentSchema) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => {
      const result = await toolsService.listAgents(caller, projectId)
      if (!result.ok) {
        return { isError: true, content: [{ type: "text", text: result.error }] }
      }
      return structuredResult({ agents: result.value })
    },
  )

  server.registerTool(
    "update_agent",
    {
      title: "Update agent",
      description:
        "Changes the draft settings of an agent (model, instructions, language, greeting). Only the given settings change. Nothing is published: the user reviews and publishes the draft in the studio, from the returned link.",
      inputSchema: updateAgentInputSchema,
      outputSchema: z.looseObject({ agent: agentSchema.extend({ draftRevision: z.number() }) }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await toolsService.updateAgent(caller, input)
      if (!result.ok) {
        return { isError: true, content: [{ type: "text", text: result.error }] }
      }
      return structuredResult({ agent: result.value })
    },
  )

  server.registerTool(
    "duplicate_agent",
    {
      title: "Duplicate agent",
      description:
        "Copies an agent into a new agent of the same project, under a new name: its published settings (model, instructions, language, greeting, built-in tools), its MCP servers, its sub-agents, its documents and resource libraries, and its conversation categories. Conversations, analytics, members and the embed settings are not copied. The copy's settings are a draft: nothing is published, the user reviews and publishes it in the studio, from the returned link.",
      inputSchema: duplicateAgentInputSchema,
      outputSchema: z.looseObject({ agent: agentSchema.extend({ draftRevision: z.number() }) }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await toolsService.duplicateAgent(caller, input)
      if (!result.ok) {
        return { isError: true, content: [{ type: "text", text: result.error }] }
      }
      return structuredResult({ agent: result.value })
    },
  )

  return server
}

function structuredResult<T extends Record<string, unknown>>(output: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output) }],
    structuredContent: output,
  }
}

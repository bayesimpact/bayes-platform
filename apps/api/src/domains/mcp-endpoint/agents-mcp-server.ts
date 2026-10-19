import { type CallToolResult, McpServer } from "@modelcontextprotocol/server"
import { getMcpServerTitle } from "@/config/mcp-server-title"
import type { McpAgentToolsService, McpCaller } from "./mcp-agent-tools.service"
import {
  toMcpAgent,
  toMcpCreatedAgent,
  toMcpProject,
  toMcpUpdatedAgent,
} from "./mcp-endpoint.mapper"
import {
  createAgentInputSchema,
  createAgentOutputSchema,
  listAgentsInputSchema,
  listAgentsOutputSchema,
  listProjectsOutputSchema,
  updateAgentInputSchema,
  updateAgentOutputSchema,
} from "./mcp-endpoint.schemas"

export const MCP_SERVER_NAME = "agents"
export const MCP_SERVER_VERSION = "1.0.0"

const MCP_SERVER_INSTRUCTIONS = [
  "Creates and updates agents on the platform for the signed-in user.",
  "Call list_projects first: an agent always belongs to a project. It lists the projects the user granted to this client, and only the ones with canCreateAgents set to true accept new agents.",
  "Then call create_agent with that project's id. It returns the agent's id and, when the platform knows its public URL, a link to the agent in the studio.",
  "To change an existing agent, call list_agents with the project's id, then update_agent with the agent's id: only the agents with canUpdate set to true can be changed. update_agent edits the draft; the user publishes it in the studio.",
].join(" ")

/**
 * One MCP server per request, bound to the person and their grant: the
 * endpoint is stateless, so nothing outlives the HTTP exchange.
 */
export function buildAgentsMcpServer({
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
      outputSchema: listProjectsOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const projects = await toolsService.listProjects(caller)
      return structuredResult({ projects: projects.map(toMcpProject) })
    },
  )

  server.registerTool(
    "create_agent",
    {
      title: "Create agent",
      description:
        "Creates an agent in a project and publishes its first version. Documents, tags and other settings are edited afterwards in the studio.",
      inputSchema: createAgentInputSchema,
      outputSchema: createAgentOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await toolsService.createAgent(caller, input)
      if (!result.ok) return errorResult(result.error)
      return structuredResult({ agent: toMcpCreatedAgent(result.value) })
    },
  )

  server.registerTool(
    "list_agents",
    {
      title: "List agents",
      description:
        "Lists the agents of a project the user is a member of, with their model and whether update_agent can change them.",
      inputSchema: listAgentsInputSchema,
      outputSchema: listAgentsOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => {
      const result = await toolsService.listAgents(caller, projectId)
      if (!result.ok) return errorResult(result.error)
      return structuredResult({ agents: result.value.map(toMcpAgent) })
    },
  )

  server.registerTool(
    "update_agent",
    {
      title: "Update agent",
      description:
        "Changes the draft settings of an agent (model, instructions, temperature, language, greeting). Only the given settings change. Nothing is published: the user reviews and publishes the draft in the studio, from the returned link.",
      inputSchema: updateAgentInputSchema,
      outputSchema: updateAgentOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await toolsService.updateAgent(caller, input)
      if (!result.ok) return errorResult(result.error)
      return structuredResult({ agent: toMcpUpdatedAgent(result.value) })
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

function errorResult(error: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: error }] }
}

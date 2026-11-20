import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type {
  McpServer,
  McpServerConnection,
  McpServerInspection,
  McpServerTool,
} from "./mcp-servers.models"

type McpServerTransientParams = {
  project: Project
}

const SERVER_NAMES = [
  "Knowledge Base",
  "Calendar Service",
  "CRM Integration",
  "Task Manager",
  "Search Engine",
]

class McpServerFactory extends Factory<McpServer, McpServerTransientParams> {}

export const mcpServerFactory = McpServerFactory.define(({ params, transientParams }) => {
  const { project } = transientParams
  if (!project) {
    throw new Error("Project must be provided in transient params to build an McpServer")
  }

  return {
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? faker.helpers.arrayElement(SERVER_NAMES),
    url: params.url ?? faker.internet.url(),
    projectId: params.projectId !== undefined ? params.projectId : project.id,
    isBuiltIn: params.isBuiltIn ?? false,
    authMethod: params.authMethod ?? "none",
    authStatus: params.authStatus ?? "none",
    headerNames: (params.headerNames ?? []).filter((name) => name !== undefined),
    createdAt: params.createdAt ?? faker.date.past().getTime(),
    updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
  }
})

/** The PDF export server every workspace ships with. It has no project of its own and cannot be deleted. */
export function buildPdfExportMcpServer(project: Project): McpServer {
  return mcpServerFactory.transient({ project }).build({
    id: "built-in-pdf-export",
    name: "PDF export",
    url: "https://pdf-converter.internal/mcp",
    isBuiltIn: true,
    projectId: null,
  })
}

const TOOL_NAMES = [
  "search_articles",
  "get_article",
  "list_categories",
  "create_ticket",
  "update_ticket",
  "list_events",
]

export const mcpServerToolFactory = Factory.define<McpServerTool>(({ params, sequence }) => ({
  name: params.name ?? TOOL_NAMES[(sequence - 1) % TOOL_NAMES.length] ?? `tool_${sequence}`,
  description: params.description !== undefined ? params.description : faker.lorem.sentence(),
}))

/** A server that answered, with three tools. Override `status`, `tools` and `error` for the other cases. */
export const mcpServerInspectionFactory = Factory.define<McpServerInspection>(({ params }) => {
  const status = params.status ?? "connected"
  const defaultTools = status === "connected" ? mcpServerToolFactory.buildList(3) : []
  return {
    status,
    tools: params.tools
      ? params.tools.map((tool) => mcpServerToolFactory.build(tool ?? {}))
      : defaultTools,
    error:
      params.error !== undefined
        ? params.error === null
          ? null
          : {
              code: params.error.code ?? "unknown",
              httpStatus: params.error.httpStatus ?? null,
              detail: params.error.detail ?? faker.lorem.sentence(),
            }
        : status === "failed"
          ? {
              code: "unauthorized",
              httpStatus: 401,
              detail: "MCP HTTP Transport Error: POSTing to endpoint (HTTP 401): invalid token",
            }
          : null,
    checkedAt: params.checkedAt ?? faker.date.recent().getTime(),
  }
})

/** The connection the studio shows once an inspection answered. */
export function buildCheckedConnection(
  inspection: Partial<McpServerInspection> = {},
  { isRefreshing = false }: { isRefreshing?: boolean } = {},
): McpServerConnection {
  return {
    state: "checked",
    inspection: mcpServerInspectionFactory.build(inspection),
    isRefreshing,
  }
}

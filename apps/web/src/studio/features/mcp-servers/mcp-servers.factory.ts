import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { McpServer } from "./mcp-servers.models"

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

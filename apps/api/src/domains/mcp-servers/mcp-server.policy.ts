import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import { isBuiltInMcpServer } from "./built-in/built-in-mcp-servers"
import type { McpServer } from "./mcp-server.entity"

export class McpServerPolicy extends ProjectScopedPolicy<McpServer> {
  /** Built-in servers are platform-provided: no project can delete them. */
  canDelete(): boolean {
    return super.canDelete() && !this.isBuiltIn()
  }

  protected doesResourceBelongToScope(): boolean {
    const mcpServer = this.resolveEntity()
    if (!mcpServer) return false
    // Built-in servers belong to no project but are usable from every one.
    // This also makes canUpdate() permissive for them; revisit when an update
    // route exists, since only the platform should edit a built-in.
    if (isBuiltInMcpServer(mcpServer)) return true
    return mcpServer.projectId === this.project?.id
  }

  private isBuiltIn(): boolean {
    const mcpServer = this.resolveEntity()
    return !!mcpServer && isBuiltInMcpServer(mcpServer)
  }

  /**
   * The policy is built from the request, so the entity may be missing or not
   * be an MCP server at all: narrow it once here.
   */
  private resolveEntity(): McpServer | undefined {
    if (
      !this.entity ||
      typeof this.entity !== "object" ||
      !("presetSlug" in this.entity) ||
      !("projectId" in this.entity)
    ) {
      return undefined
    }
    return this.entity
  }
}

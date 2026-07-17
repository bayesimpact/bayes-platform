import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { McpServer } from "./mcp-server.entity"

export class McpServerPolicy extends ProjectScopedPolicy<McpServer> {
  protected doesResourceBelongToScope(): boolean {
    if (!this.entity || typeof this.entity !== "object" || !("projectId" in this.entity)) {
      return false
    }
    return this.entity.projectId === this.project?.id
  }
}

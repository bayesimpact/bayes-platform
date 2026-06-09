import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"

export class AgentCsvExtractionRunPolicy extends ProjectScopedPolicy<AgentCsvExtractionRun> {
  canList(): boolean {
    return this.canAccess()
  }

  canCreate(): boolean {
    return this.canAccess()
  }

  canUpdate(): boolean {
    return this.canAccess() && this.doesResourceBelongToScope()
  }

  canDelete(): boolean {
    return this.canUpdate()
  }
}

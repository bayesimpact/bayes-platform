import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { Document } from "@/domains/documents/document.entity"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"
import type {
  AgentCsvExtractionRun,
  AgentCsvExtractionRunColumnSchema,
  AgentCsvExtractionRunSummary,
} from "./agent-csv-extraction-run.entity"

type AgentCsvExtractionRunTransientParams = {
  organization: Organization
  project: Project
  agent: Agent
  agentSettings: AgentSettings
  csvDocument: Document
}

const defaultColumnSchema = (): AgentCsvExtractionRunColumnSchema => ({
  "col-name": {
    id: "col-name",
    originalName: "name",
    finalName: "name",
    role: "input",
    index: 0,
  },
})

class AgentCsvExtractionRunFactory extends Factory<
  AgentCsvExtractionRun,
  AgentCsvExtractionRunTransientParams
> {}

export const agentCsvExtractionRunFactory = AgentCsvExtractionRunFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.agent) {
      throw new Error("agent transient is required")
    }
    if (!transientParams.agentSettings) {
      throw new Error("agentSettings transient is required")
    }
    if (!transientParams.csvDocument) {
      throw new Error("csvDocument transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      agentSettingsId: transientParams.agentSettings.id,
      agentSettings: transientParams.agentSettings,
      csvDocumentId: transientParams.csvDocument.id,
      csvDocument: transientParams.csvDocument,
      columnSchema:
        (params.columnSchema as AgentCsvExtractionRunColumnSchema) || defaultColumnSchema(),
      status: params.status || "pending",
      summary: (params.summary as AgentCsvExtractionRunSummary) ?? null,
      records: params.records || [],
      csvExportDocumentId: params.csvExportDocumentId ?? null,
      csvExportDocument: null,
      //fixme DOO : to delete as the same time we delete the fields in db: it's just a security ...
      _deleted_agentId: transientParams.agent.id,
      _deleted_agent: transientParams.agent, //fixme DOO
    } satisfies AgentCsvExtractionRun
  },
)

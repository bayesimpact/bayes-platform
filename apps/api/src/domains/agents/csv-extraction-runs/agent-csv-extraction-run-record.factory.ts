import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"
import type { AgentCsvExtractionRunRecord } from "./agent-csv-extraction-run-record.entity"

type AgentCsvExtractionRunRecordTransientParams = {
  organization: Organization
  project: Project
  agentCsvExtractionRun: AgentCsvExtractionRun
}

class AgentCsvExtractionRunRecordFactory extends Factory<
  AgentCsvExtractionRunRecord,
  AgentCsvExtractionRunRecordTransientParams
> {}

export const agentCsvExtractionRunRecordFactory = AgentCsvExtractionRunRecordFactory.define(
  ({ sequence, params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.agentCsvExtractionRun) {
      throw new Error("agentCsvExtractionRun transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      agentCsvExtractionRunId: transientParams.agentCsvExtractionRun.id,
      agentCsvExtractionRun: transientParams.agentCsvExtractionRun,
      rowIndex: params.rowIndex ?? sequence,
      inputData: params.inputData ?? { name: `Row ${sequence}` },
      agentRawOutput: params.agentRawOutput ?? null,
      status: params.status || "success",
      errorDetails: params.errorDetails ?? null,
      traceId: params.traceId ?? null,
    } satisfies AgentCsvExtractionRunRecord
  },
)

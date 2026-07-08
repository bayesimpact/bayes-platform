import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { EvaluationExtractionDataset } from "../datasets/evaluation-extraction-dataset.entity"
import type {
  EvaluationExtractionRun,
  EvaluationExtractionRunKeyMapping,
  EvaluationExtractionRunSummary,
} from "./evaluation-extraction-run.entity"

type EvaluationExtractionRunTransientParams = RequiredScopeTransientParams & {
  agent: Agent
  agentSettings: AgentSettings
  evaluationExtractionDataset: EvaluationExtractionDataset
}

class EvaluationExtractionRunFactory extends Factory<
  EvaluationExtractionRun,
  EvaluationExtractionRunTransientParams
> {}

export const evaluationExtractionRunFactory = EvaluationExtractionRunFactory.define(
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
    if (!transientParams.evaluationExtractionDataset) {
      throw new Error("evaluationExtractionDataset transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      evaluationExtractionDatasetId: transientParams.evaluationExtractionDataset.id,
      evaluationExtractionDataset: transientParams.evaluationExtractionDataset,
      agentId: transientParams.agent.id,
      agent: transientParams.agent,
      agentSettingsId: transientParams.agentSettings.id,
      agentSettings: transientParams.agentSettings,
      keyMapping: (params.keyMapping || []) as EvaluationExtractionRunKeyMapping,
      status: params.status || "pending",
      summary: (params.summary as EvaluationExtractionRunSummary) || null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      records: params.records || [],
      csvExportDocumentId: params.csvExportDocumentId || null,
      csvExportDocument: null,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
    } satisfies EvaluationExtractionRun
  },
)

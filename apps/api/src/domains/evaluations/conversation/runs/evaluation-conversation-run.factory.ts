import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { EvaluationConversationDataset } from "../datasets/evaluation-conversation-dataset.entity"
import type {
  EvaluationConversationRun,
  EvaluationConversationRunSummary,
} from "./evaluation-conversation-run.entity"

type EvaluationConversationRunTransientParams = RequiredScopeTransientParams & {
  agent: Agent
  agentSettings: AgentSettings
  evaluationConversationDataset: EvaluationConversationDataset
}

class EvaluationConversationRunFactory extends Factory<
  EvaluationConversationRun,
  EvaluationConversationRunTransientParams
> {}

export const evaluationConversationRunFactory = EvaluationConversationRunFactory.define(
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
    if (!transientParams.evaluationConversationDataset) {
      throw new Error("evaluationConversationDataset transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      evaluationConversationDatasetId: transientParams.evaluationConversationDataset.id,
      evaluationConversationDataset: transientParams.evaluationConversationDataset,
      agentId: transientParams.agent.id,
      agent: transientParams.agent,
      agentSettingsId: transientParams.agentSettings.id,
      agentSettings: transientParams.agentSettings,
      status: params.status || "pending",
      summary: (params.summary as EvaluationConversationRunSummary) || null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      records: params.records || [],
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
    } satisfies EvaluationConversationRun
  },
)

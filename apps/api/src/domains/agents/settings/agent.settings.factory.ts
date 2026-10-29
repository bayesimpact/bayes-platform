import { randomUUID } from "node:crypto"
import { AgentMemoryMode, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "./agent-settings.entity"

type AgentSettingsTransientParams = RequiredScopeTransientParams & {
  agent: Agent
}

class AgentSettingsFactory extends Factory<AgentSettings, AgentSettingsTransientParams> {
  draft() {
    return this.params({ isDraft: true })
  }

  archived() {
    return this.params({ isArchived: true })
  }
}

export const agentSettingsFactory = AgentSettingsFactory.define(
  ({ sequence, params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.agent) {
      throw new Error("agent transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      revision: params.revision ?? 1,
      instructions: params.instructions || `This is a test default prompt for bot ${sequence}`,
      variables: (params.variables as Record<string, string> | undefined) ?? null,
      model: params.model || AgentModel._Mock,
      deletedTemperature: params.deletedTemperature ?? 0.7,
      documentsRagMode: params.documentsRagMode || DocumentsRagMode.All,
      greetingMessage: params.greetingMessage ?? null,
      outputJsonSchema: params.outputJsonSchema ?? null,
      fillFormEnabled: params.fillFormEnabled ?? false,
      priorityCallsEnabled: params.priorityCallsEnabled ?? false,
      providerOptions: params.providerOptions ?? {},
      memoryMode: params.memoryMode || AgentMemoryMode.Off,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      agentId: transientParams.agent.id,
      agent: transientParams.agent,
      isDraft: params.isDraft ?? false,
      isArchived: params.isArchived ?? false,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt || null,
    }
  },
)

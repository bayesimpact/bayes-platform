import { randomUUID } from "node:crypto"
import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "./agent-settings.entity"

type AgentSettingsTransientParams = RequiredScopeTransientParams & {
  agent: Agent
}

class AgentSettingsFactory extends Factory<AgentSettings, AgentSettingsTransientParams> {}

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
      model: params.model || AgentModel._MockStreamChatResponse,
      temperature: params.temperature ?? 0.7,
      locale: params.locale || AgentLocale.EN,
      documentsRagMode: params.documentsRagMode || DocumentsRagMode.All,
      greetingMessage: params.greetingMessage ?? null,
      outputJsonSchema: params.outputJsonSchema ?? null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      agentId: transientParams.agent.id,
      agent: transientParams.agent,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt || null,
    }
  },
)

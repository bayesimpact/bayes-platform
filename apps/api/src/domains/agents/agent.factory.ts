import { randomUUID } from "node:crypto"
import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "./agent.entity"

type AgentTransientParams = RequiredScopeTransientParams

class AgentFactory extends Factory<Agent, AgentTransientParams> {}

export const agentFactory = AgentFactory.define(({ sequence, params, transientParams }) => {
  if (!transientParams.organization) {
    throw new Error("organization transient is required")
  }
  if (!transientParams.project) {
    throw new Error("project transient is required")
  }

  const now = new Date()
  return {
    id: params.id || randomUUID(),
    name: params.name || `Test Agent ${sequence}`,
    defaultPrompt: params.defaultPrompt || `This is a test default prompt for bot ${sequence}`,
    model: params.model || AgentModel._MockStreamChatResponse,
    temperature: params.temperature ?? 0.7,
    locale: params.locale || AgentLocale.EN,
    type: params.type || "conversation",
    documentsRagMode: params.documentsRagMode || DocumentsRagMode.All,
    instructionPrompt: params.instructionPrompt ?? null,
    greetingMessage: params.greetingMessage ?? null,
    outputJsonSchema: params.outputJsonSchema ?? null,
    organizationId: transientParams.organization.id,
    projectId: transientParams.project.id,
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: params.deletedAt || null,
    project: transientParams.project,
    conversationAgentSessions: params.conversationAgentSessions || [],
    evaluationReports: params.evaluationReports || [],
    extractionSessions: params.extractionSessions || [],
    documentTags: params.documentTags || [],
    agentMemberships: params.agentMemberships || [],
    agentMcpServers: params.agentMcpServers || [],
    reviewCampaigns: params.reviewCampaigns || [],
    categories: params.categories || [],
  } satisfies Agent
})

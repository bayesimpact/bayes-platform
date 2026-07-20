import { randomUUID } from "node:crypto"
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
    type: params.type || "conversation",
    organizationId: transientParams.organization.id,
    projectId: transientParams.project.id,
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: params.deletedAt || null,
    project: transientParams.project,
    conversationAgentSessions: params.conversationAgentSessions || [],
    evaluationReports: params.evaluationReports || [],
    documentTags: params.documentTags || [],
    agentMcpServers: params.agentMcpServers || [],
    reviewCampaigns: params.reviewCampaigns || [],
    sessionCategories: params.sessionCategories || [],
    childSubAgents: params.childSubAgents || [],
    parentSubAgents: params.parentSubAgents || [],
    resourceLibraries: params.resourceLibraries || [],
  } satisfies Agent
})

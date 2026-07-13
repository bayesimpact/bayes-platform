import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import { v4 } from "uuid"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { Document } from "@/domains/documents/document.entity"
import type { User } from "@/domains/users/user.entity"
import type { ExtractionAgentSession } from "./extraction-agent-session.entity"

type AgentSessionTransientParams = RequiredScopeTransientParams & {
  agent: Agent
  agentSettings: AgentSettings
  user: User
  document: Document
}

class ExtractionAgentSessionFactory extends Factory<
  ExtractionAgentSession,
  AgentSessionTransientParams
> {
  playground() {
    return this.params({ type: "playground" })
  }

  live() {
    return this.params({ type: "live" })
  }
}

export const extractionAgentSessionFactory = ExtractionAgentSessionFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.document) {
      throw new Error("document transient is required")
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
    if (!transientParams.user) {
      throw new Error("user transient is required")
    }

    const now = new Date()

    return {
      id: params.id || randomUUID(),
      agentId: transientParams.agent.id,
      agent: transientParams.agent,
      agentSettingsId: transientParams.agentSettings.id,
      agentSettings: transientParams.agentSettings,
      userId: transientParams.user.id,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      type: params.type || "playground",
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: null,
      user: transientParams.user,
      document: transientParams.document,
      documentId: transientParams.document.id,
      effectivePrompt: params.effectivePrompt || "",
      errorCode: params.errorCode || null,
      errorDetails: params.errorDetails || null,
      result: params.result || null,
      status: params.status || "success",
      traceId: v4(),
      campaignId: params.campaignId ?? null,
      reviewCampaign: null,
      //fixme DOO : to delete as the same time we delete the fields in db: it's just a security ...
      _deleted_schemaSnapshot: params._deleted_schemaSnapshot || {},
    } satisfies ExtractionAgentSession
  },
)

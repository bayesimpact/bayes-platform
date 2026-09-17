import { Factory } from "fishery"
import { v4 } from "uuid"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { ConversationForm } from "./conversation-form.entity"

type ConversationFormTransientParams = RequiredScopeTransientParams & {
  agent: Agent
  agentSettings: AgentSettings
  /** The conversation or public session that owns the form. */
  session: { id: string }
}

class ConversationFormFactory extends Factory<ConversationForm, ConversationFormTransientParams> {
  concluded() {
    return this.params({ status: "concluded" })
  }
}

export const conversationFormFactory = ConversationFormFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.organization) throw new Error("organization transient is required")
    if (!transientParams.project) throw new Error("project transient is required")
    if (!transientParams.agent) throw new Error("agent transient is required")
    if (!transientParams.agentSettings) throw new Error("agentSettings transient is required")
    if (!transientParams.session) throw new Error("session transient is required")

    const now = new Date()
    return {
      id: params.id ?? v4(),
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      sessionId: transientParams.session.id,
      agentId: transientParams.agent.id,
      agent: transientParams.agent,
      agentSettingsId: transientParams.agentSettings.id,
      agentSettings: transientParams.agentSettings,
      status: params.status ?? "in_progress",
      state: (params.state as Record<string, unknown> | undefined) ?? {},
      createdAt: params.createdAt ?? now,
      updatedAt: params.updatedAt ?? now,
      deletedAt: null,
    } satisfies ConversationForm
  },
)

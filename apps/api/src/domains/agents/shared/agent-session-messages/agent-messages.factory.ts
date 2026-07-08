import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Repository } from "typeorm"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { ConversationAgentSession } from "../../conversation-agent-sessions/conversation-agent-session.entity"
import type { FormAgentSession } from "../../form-agent-sessions/form-agent-session.entity"
import type { AgentMessage } from "./agent-message.entity"

type AgentSession = ConversationAgentSession | FormAgentSession
type AgentMessageTransientParams = RequiredScopeTransientParams & {
  session: AgentSession
  agentSettings: AgentSettings
}

class AgentMessageFactory extends Factory<AgentMessage, AgentMessageTransientParams> {
  user() {
    return this.params({ role: "user" })
  }

  assistant() {
    return this.params({ role: "assistant" })
  }

  streaming() {
    return this.params({ status: "streaming" })
  }

  sentMinutesAgo(minutes: number) {
    return this.params({ startedAt: new Date(Date.now() - minutes * 60 * 1000) })
  }
}

export const agentMessageFactory = AgentMessageFactory.define(
  ({ sequence, params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.session) {
      throw new Error("session transient is required")
    }
    if (!transientParams.agentSettings) {
      throw new Error("agentSettings transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      sessionId: transientParams.session.id,
      agentSettingsId: transientParams.agentSettings.id,
      agentSettings: transientParams.agentSettings,
      role: params.role || (sequence % 2 === 0 ? "user" : "assistant"),
      content: params.content || `Test message ${sequence}`,
      status: params.status ?? null,
      startedAt: params.startedAt ?? null,
      completedAt: params.completedAt ?? null,
      toolCalls: params.toolCalls ?? null,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: null,
      session: () => transientParams.session,
      agentMessageFeedbacks: params.agentMessageFeedbacks || [],
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      documentId: params.documentId ?? null,
      document: null, // TODO: transientParams??
      attachmentDocumentId: params.attachmentDocumentId ?? null,
      attachmentDocument: null,
    } satisfies AgentMessage
  },
)

type BuildAgentConversationParams = {
  userMessage?: Partial<AgentMessage>
  assistantMessage?: Partial<AgentMessage>
}

export function buildChitChatConversation(
  organization: Organization,
  project: Project,
  session: AgentSession,
  agentSettings: AgentSettings,
  params: BuildAgentConversationParams = {},
): [AgentMessage, AgentMessage] {
  const userMessage = agentMessageFactory
    .user()
    .transient({ organization, project, session, agentSettings })
    .build({
      content: "Hello",
      ...params.userMessage,
    })

  const assistantMessage = agentMessageFactory
    .assistant()
    .transient({ organization, project, session, agentSettings })
    .build({
      content: "Hi!",
      ...params.assistantMessage,
    })

  return [userMessage, assistantMessage]
}

type createConversationAgentSessionMessageRepositories = {
  agentMessageRepository: Repository<AgentMessage>
}

export async function createChitChatConversation(
  organization: Organization,
  project: Project,
  session: AgentSession,
  agentSettings: AgentSettings,
  repositories: createConversationAgentSessionMessageRepositories,
  params: BuildAgentConversationParams = {},
): Promise<[AgentMessage, AgentMessage]> {
  const [userMessage, assistantMessage] = buildChitChatConversation(
    organization,
    project,
    session,
    agentSettings,
    params,
  )
  await repositories.agentMessageRepository.save([userMessage, assistantMessage])
  return [userMessage, assistantMessage]
}

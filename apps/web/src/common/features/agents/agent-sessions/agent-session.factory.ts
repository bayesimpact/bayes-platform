import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type {
  ConversationAgentSession,
  ConversationForm,
  ConversationSubSession,
} from "./conversation/conversation-agent-sessions.models"
import type { ExtractionAgentSessionSummary } from "./extraction/extraction-agent-sessions.models"
import type {
  AgentSessionMcpAppHtml,
  AgentSessionMessage,
} from "./shared/agent-session-messages/agent-session-messages.models"

type SessionTransientParams = {
  agent?: Pick<Agent, "id">
}

class ConversationAgentSessionFactory extends Factory<
  ConversationAgentSession,
  SessionTransientParams
> {
  /** A session whose agent has filled part of its form, for fillForm-enabled agents. */
  withForm(state?: Record<string, unknown>) {
    return this.afterBuild((session) => {
      session.forms = [
        conversationFormFactory.build({
          agentId: session.agentId,
          state: state ?? { title: faker.commerce.productName(), summary: faker.lorem.sentence() },
        }),
      ]
    })
  }
}

class ConversationFormFactory extends Factory<ConversationForm> {}

export const conversationFormFactory = ConversationFormFactory.define(({ params }) => ({
  agentId: params.agentId ?? faker.string.uuid(),
  agentSettingsId: params.agentSettingsId ?? faker.string.uuid(),
  status: params.status ?? "in_progress",
  state: (params.state as Record<string, unknown> | undefined) ?? {},
  updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
}))

export const conversationAgentSessionFactory = ConversationAgentSessionFactory.define(
  ({ params, transientParams }) => {
    const time = params.createdAt ?? faker.date.recent().getTime()
    return {
      id: params.id ?? faker.string.uuid(),
      agentId: params.agentId ?? transientParams.agent?.id ?? faker.string.uuid(),
      type: params.type ?? "live",
      createdAt: time,
      updatedAt: params.updatedAt ?? time,
      forms: (params.forms as ConversationForm[] | undefined) ?? [],
    } satisfies ConversationAgentSession
  },
)

type ConversationSubSessionTransientParams = SessionTransientParams & {
  session?: ConversationAgentSession
}

class ConversationSubSessionFactory extends Factory<
  ConversationSubSession,
  ConversationSubSessionTransientParams
> {}

export const conversationSubSessionFactory = ConversationSubSessionFactory.define(
  ({ params, transientParams }): ConversationSubSession => {
    const session =
      transientParams.session ??
      conversationAgentSessionFactory
        .withForm()
        .transient(transientParams)
        .build({ type: "playground" })
    return {
      toolName: params.toolName ?? faker.helpers.slugify(faker.word.verb()).replace(/-/g, "_"),
      agentId: params.agentId ?? session.agentId,
      agentName: params.agentName ?? faker.commerce.productName(),
      outputJsonSchema: params.outputJsonSchema ?? {
        type: "object",
        properties: { title: { type: "string" }, summary: { type: "string" } },
      },
      session,
    }
  },
)

class ExtractionAgentSessionSummaryFactory extends Factory<
  ExtractionAgentSessionSummary,
  SessionTransientParams
> {}

export const extractionAgentSessionSummaryFactory = ExtractionAgentSessionSummaryFactory.define(
  ({ params, transientParams }) => {
    const time = params.createdAt ?? faker.date.recent().getTime()
    return {
      id: params.id ?? faker.string.uuid(),
      agentId: params.agentId ?? transientParams.agent?.id ?? faker.string.uuid(),
      agentRevision: params.agentRevision ?? 1,
      documentId: params.documentId ?? faker.string.uuid(),
      documentFileName: params.documentFileName ?? `${faker.system.commonFileName("pdf")}`,
      traceUrl: params.traceUrl,
      type: params.type ?? "live",
      status: params.status ?? "success",
      createdAt: time,
      updatedAt: params.updatedAt ?? time,
    } satisfies ExtractionAgentSessionSummary
  },
)

class AgentSessionMessageFactory extends Factory<AgentSessionMessage> {}

export const agentSessionMessageFactory = AgentSessionMessageFactory.define(({ params }) => ({
  id: params.id ?? faker.string.uuid(),
  role: params.role ?? "user",
  content: params.content ?? faker.lorem.sentence(),
  status: params.status ?? "completed",
  agentRevision: params.agentRevision,
  toolCalls: params.toolCalls,
}))

class AgentSessionMcpAppHtmlFactory extends Factory<AgentSessionMcpAppHtml> {}

export const agentSessionMcpAppHtmlFactory = AgentSessionMcpAppHtmlFactory.define(({ params }) => ({
  mcpServerId: params.mcpServerId ?? faker.string.uuid(),
  resourceUri: params.resourceUri ?? `ui://${faker.lorem.slug()}/mcp-app.html`,
  html: params.html ?? "<!DOCTYPE html><html><body></body></html>",
}))

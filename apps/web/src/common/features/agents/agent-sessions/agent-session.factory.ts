import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type {
  ConversationAgentSession,
  ConversationSubSession,
} from "./conversation/conversation-agent-sessions.models"
import type { ExtractionAgentSessionSummary } from "./extraction/extraction-agent-sessions.models"
import type { AgentSessionMessage } from "./shared/agent-session-messages/agent-session-messages.models"

type SessionTransientParams = {
  agent?: Pick<Agent, "id">
}

class ConversationAgentSessionFactory extends Factory<
  ConversationAgentSession,
  SessionTransientParams
> {
  /** A session carrying a filled form state, for fillForm-enabled agents. */
  withResult() {
    return this.params({
      result: {
        title: faker.commerce.productName(),
        summary: faker.lorem.sentence(),
      },
    })
  }
}

export const conversationAgentSessionFactory = ConversationAgentSessionFactory.define(
  ({ params, transientParams }) => {
    const time = params.createdAt ?? faker.date.recent().getTime()
    return {
      id: params.id ?? faker.string.uuid(),
      agentId: params.agentId ?? transientParams.agent?.id ?? faker.string.uuid(),
      type: params.type ?? "live",
      createdAt: time,
      updatedAt: params.updatedAt ?? time,
      result: params.result ?? undefined,
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
        .withResult()
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
  toolCalls: params.toolCalls,
}))

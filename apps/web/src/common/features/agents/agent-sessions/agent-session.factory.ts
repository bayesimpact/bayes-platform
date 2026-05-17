import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { ConversationAgentSession } from "./conversation/conversation-agent-sessions.models"
import type { ExtractionAgentSessionSummary } from "./extraction/extraction-agent-sessions.models"
import type { FormAgentSession } from "./form/form-agent-sessions.models"
import type { AgentSessionMessage } from "./shared/agent-session-messages/agent-session-messages.models"

type SessionTransientParams = {
  agent?: Pick<Agent, "id">
}

class ConversationAgentSessionFactory extends Factory<
  ConversationAgentSession,
  SessionTransientParams
> {}

export const conversationAgentSessionFactory = ConversationAgentSessionFactory.define(
  ({ params, transientParams }) => {
    const time = params.createdAt ?? faker.date.recent().getTime()
    return {
      id: params.id ?? faker.string.uuid(),
      agentId: params.agentId ?? transientParams.agent?.id ?? faker.string.uuid(),
      type: params.type ?? "live",
      createdAt: time,
      updatedAt: params.updatedAt ?? time,
    } satisfies ConversationAgentSession
  },
)

class FormAgentSessionFactory extends Factory<FormAgentSession, SessionTransientParams> {}

export const formAgentSessionFactory = FormAgentSessionFactory.define(
  ({ params, transientParams }): FormAgentSession => {
    const time = params.createdAt ?? faker.date.recent().getTime()
    return {
      id: params.id ?? faker.string.uuid(),
      agentId: params.agentId ?? transientParams.agent?.id ?? faker.string.uuid(),
      type: params.type ?? "live",
      createdAt: time,
      updatedAt: params.updatedAt ?? time,
      result: params.result ?? {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        company: faker.company.name(),
        role: faker.person.jobTitle(),
        country: faker.location.country(),
        city: faker.location.city(),
        industry: faker.commerce.department(),
        teamSize: faker.string.numeric({ length: { min: 1, max: 2 } }),
      },
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
}))

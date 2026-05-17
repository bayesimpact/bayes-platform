import type {
  AgentSessionMessageDto,
  ConversationAgentSessionDto,
  ExtractionAgentSessionSummaryDto,
  FormAgentSessionDto,
} from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"

type SessionTransientParams = {
  agent?: Pick<Agent, "id">
}

class ConversationAgentSessionFactory extends Factory<
  ConversationAgentSessionDto,
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
    }
  },
)

class FormAgentSessionFactory extends Factory<FormAgentSessionDto, SessionTransientParams> {}

export const formAgentSessionFactory = FormAgentSessionFactory.define(
  ({ params, transientParams }) => {
    const time = params.createdAt ?? faker.date.recent().getTime()
    return {
      id: params.id ?? faker.string.uuid(),
      agentId: params.agentId ?? transientParams.agent?.id ?? faker.string.uuid(),
      type: params.type ?? "live",
      createdAt: time,
      updatedAt: params.updatedAt ?? time,
    }
  },
)

class ExtractionAgentSessionSummaryFactory extends Factory<
  ExtractionAgentSessionSummaryDto,
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
    }
  },
)

class AgentSessionMessageFactory extends Factory<AgentSessionMessageDto> {}

export const agentSessionMessageFactory = AgentSessionMessageFactory.define(({ params }) => ({
  id: params.id ?? faker.string.uuid(),
  role: params.role ?? "user",
  content: params.content ?? faker.lorem.sentence(),
  status: params.status ?? "completed",
}))

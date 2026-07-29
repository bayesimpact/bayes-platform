import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import { agentOutputJsonSchemaFactory } from "@/common/features/agents/agent.factory"
import type { Agent } from "@/common/features/agents/agents.models"
import type { AgentSettings } from "./agent-settings.models"

type AgentSettingsTransientParams = {
  agent: Agent
}

class AgentSettingsFactory extends Factory<AgentSettings, AgentSettingsTransientParams> {
  /** A revision with the fillForm tool enabled and a form definition. */
  fillForm() {
    return this.params({
      fillFormEnabled: true,
      outputJsonSchema: agentOutputJsonSchemaFactory.build(),
    })
  }
}

export const agentSettingsFactory = AgentSettingsFactory.define(({ params, transientParams }) => {
  const { agent } = transientParams
  if (!agent) {
    throw new Error("Agent must be provided in transient params to build AgentSettings")
  }

  return {
    id: params.id ?? faker.string.uuid(),
    agentId: agent.id,
    revision: params.revision ?? 1,
    revisionName: params.revisionName ?? "",
    revisionDesc: params.revisionDesc ?? "",
    isDraft: params.isDraft ?? false,
    isArchived: params.isArchived ?? false,
    instructions: params.instructions ?? faker.lorem.paragraph(),
    greetingMessage: params.greetingMessage ?? undefined,
    model: params.model ?? AgentModel.Gemini25Flash,
    temperature: params.temperature ?? 0.7,
    locale: params.locale ?? AgentLocale.EN,
    documentsRagMode: params.documentsRagMode ?? DocumentsRagMode.None,
    outputJsonSchema: params.outputJsonSchema ?? undefined,
    fillFormEnabled: params.fillFormEnabled ?? false,
    createdAt: params.createdAt ?? faker.date.past().getTime(),
    updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
  }
})

import {
  AgentLocale,
  DEFAULT_AGENT_MODEL,
  DocumentsRagMode,
  type outputJsonSchemaSchema,
} from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { z } from "zod"
import type { Agent } from "../agents.models"
import type { AgentSettings } from "./agent-settings.models"

type OutputJsonSchema = z.infer<typeof outputJsonSchemaSchema>

type AgentSettingsTransientParams = {
  agent: Agent
}

class AgentOutputJsonSchemaFactory extends Factory<OutputJsonSchema> {}

export const agentOutputJsonSchemaFactory = AgentOutputJsonSchemaFactory.define(({ params }) => {
  const properties: OutputJsonSchema["properties"] = (params.properties ?? {
    title: { type: "string", description: faker.lorem.sentence() },
    summary: { type: "string", description: faker.lorem.sentence() },
  }) as OutputJsonSchema["properties"]
  return {
    type: "object" as const,
    properties,
    required: params.required ?? Object.keys(properties).slice(0, 1),
  }
})

class AgentSettingsFactory extends Factory<AgentSettings, AgentSettingsTransientParams> {
  /** A conversation agent with the fillForm tool enabled and a form definition. */
  fillForm() {
    return this.params({
      fillFormEnabled: true,
      outputJsonSchema: agentOutputJsonSchemaFactory.build(),
    })
  }

  priorityCalls() {
    return this.params({ priorityCallsEnabled: true })
  }
}

export const agentSettingsFactory = AgentSettingsFactory.define(({ params, transientParams }) => {
  const { agent } = transientParams
  if (!agent) {
    throw new Error("Agent must be provided in transient params to build an Agent Settings")
  }

  return {
    agentId: agent.id ?? params.agentId ?? faker.string.uuid(),
    createdAt: params.createdAt ?? faker.date.past().getTime(),
    instructions: params.instructions ?? faker.lorem.paragraph(),
    documentsRagMode: params.documentsRagMode ?? DocumentsRagMode.None,
    documentTagIds: params.documentTagIds ?? [],
    resourceLibraryIds: params.resourceLibraryIds ?? [],
    fillFormEnabled: params.fillFormEnabled ?? false,
    priorityCallsEnabled: params.priorityCallsEnabled ?? false,
    greetingMessage: params.greetingMessage ?? undefined,
    id: params.id ?? faker.string.uuid(),
    revision: params.revision ?? 1,
    name: params.name ?? "",
    description: params.description ?? "",
    isDraft: !!params.isDraft,
    isArchived: !!params.isArchived,
    locale: params.locale ?? AgentLocale.EN,
    model: params.model ?? DEFAULT_AGENT_MODEL,
    projectAgentSessionCategoryIds: params.projectAgentSessionCategoryIds ?? [],
    temperature: params.temperature ?? 0.7,
    updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    usedProjectAgentSessionCategoryIds: params.usedProjectAgentSessionCategoryIds ?? [],
    mcpServers: params.mcpServers ?? [],
  } satisfies AgentSettings
})

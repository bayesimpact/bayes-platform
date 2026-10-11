import {
  AgentLocale,
  AgentModel,
  AgentProvider,
  DocumentsRagMode,
  type outputJsonSchemaSchema,
} from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { z } from "zod"
import type { Agent } from "../agents.models"
import type { AgentModelEntry, AgentModelsCatalog, AgentSettings } from "./agent-settings.models"

/** The default models the API returns (a new agent, a new evaluation run's judge). */
export const defaultAgentModels: AgentModelsCatalog["defaults"] = {
  agent: AgentModel.Gemini35FlashLite,
  judge: AgentModel.Gemini35FlashLite,
}

const ALWAYS_SELECTABLE_PROVIDERS = [AgentProvider.Vertex, AgentProvider.Vertex3]

/** The catalog of the API, model by model (the test model is never listed). */
const CATALOG: Omit<AgentModelEntry, "selectable">[] = [
  {
    model: AgentModel.Gemini25Flash,
    provider: AgentProvider.Vertex,
    deprecation: {
      deprecatedOn: "2026-09-30",
      recommendedReplacement: AgentModel.Gemini35FlashLite,
    },
    servedOutsideEu: false,
    optionsSchema: { type: "object" },
    defaultOptions: { temperature: 0 },
  },
  {
    model: AgentModel.Gemini25Pro,
    provider: AgentProvider.Vertex,
    deprecation: { deprecatedOn: "2026-09-30", recommendedReplacement: AgentModel.Gemini35Flash },
    servedOutsideEu: false,
    optionsSchema: { type: "object" },
    defaultOptions: { temperature: 0 },
  },
  ...[
    AgentModel.Gemini31FlashLite,
    AgentModel.Gemini35FlashLite,
    AgentModel.Gemini35Flash,
    AgentModel.Gemini36Flash,
    AgentModel.Gemini37Flash,
    AgentModel.Gemini38Flash,
  ].map((model) => ({
    model,
    provider: AgentProvider.Vertex3,
    deprecation: null,
    servedOutsideEu: false,
    optionsSchema: { type: "object" },
    defaultOptions: {},
  })),
  {
    model: AgentModel.MedGemma10_27B,
    provider: AgentProvider.MedGemma,
    deprecation: null,
    servedOutsideEu: false,
    optionsSchema: { type: "object" },
    defaultOptions: { temperature: 0 },
  },
  {
    model: AgentModel.Gemma4_26B,
    provider: AgentProvider.Gemma,
    deprecation: null,
    servedOutsideEu: false,
    optionsSchema: { type: "object" },
    defaultOptions: { temperature: 0 },
  },
  {
    model: AgentModel.MistralSmall31_24B,
    provider: AgentProvider.Mistral,
    deprecation: null,
    servedOutsideEu: false,
    optionsSchema: { type: "object" },
    defaultOptions: { temperature: 0 },
  },
]

type AgentModelsCatalogTransientParams = {
  /** Providers the project may pick on top of the Vertex ones (its feature flags). */
  flaggedProviders: AgentProvider[]
}

class AgentModelsCatalogFactory extends Factory<
  AgentModelsCatalog,
  AgentModelsCatalogTransientParams
> {}

export const agentModelsCatalogFactory = AgentModelsCatalogFactory.define(
  ({ params, transientParams }) => {
    const selectableProviders = [
      ...ALWAYS_SELECTABLE_PROVIDERS,
      ...(transientParams.flaggedProviders ?? []),
    ]
    return {
      models:
        (params.models as AgentModelEntry[] | undefined) ??
        CATALOG.map((entry) => ({
          ...entry,
          selectable: selectableProviders.includes(entry.provider),
        })),
      defaults: { ...defaultAgentModels, ...params.defaults },
    }
  },
)

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
    model: params.model ?? defaultAgentModels.agent,
    projectAgentSessionCategoryIds: params.projectAgentSessionCategoryIds ?? [],
    deletedTemperature: params.deletedTemperature ?? 0.7,
    providerOptions: params.providerOptions ?? null,
    updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    usedProjectAgentSessionCategoryIds: params.usedProjectAgentSessionCategoryIds ?? [],
    mcpServers: params.mcpServers ?? [],
    deletedThinkingLevel: params.deletedThinkingLevel ?? "auto",
  } satisfies AgentSettings
})

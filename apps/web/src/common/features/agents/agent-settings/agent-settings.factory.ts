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

const JSON_SCHEMA_DRAFT = "https://json-schema.org/draft/2020-12/schema"
const TEMPERATURE_SCHEMA = { type: "number", minimum: 0, maximum: 2 }
const ALL_THINKING_LEVELS = ["minimal", "low", "medium", "high"]

/** The options of a model that only takes a temperature, as the API's JSON Schema renders them. */
const temperatureOnlyOptions = {
  optionsSchema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: "object",
    properties: { temperature: TEMPERATURE_SCHEMA },
    required: ["temperature"],
    additionalProperties: false,
  },
  defaultOptions: { temperature: 0 },
}

/** The options of a Gemini 3.x model: a thinking level, and a temperature for the oldest ones. */
function vertex3Options({
  temperature,
  levels,
  defaultLevel,
}: {
  temperature?: number
  levels: string[]
  defaultLevel: string
}) {
  const vertex = {
    type: "object",
    properties: {
      sharedRequestType: { type: "string", enum: ["priority", "flex"] },
      thinkingConfig: {
        type: "object",
        properties: {
          thinkingLevel: { type: "string", enum: levels },
          includeThoughts: { type: "boolean" },
        },
        required: ["thinkingLevel", "includeThoughts"],
        additionalProperties: false,
      },
    },
    required: ["thinkingConfig"],
    additionalProperties: false,
  }
  const providerOptions = {
    type: "object",
    properties: { vertex },
    required: ["vertex"],
    additionalProperties: false,
  }
  return {
    optionsSchema: {
      $schema: JSON_SCHEMA_DRAFT,
      type: "object",
      properties: {
        ...(temperature !== undefined ? { temperature: TEMPERATURE_SCHEMA } : {}),
        providerOptions,
      },
      required: [...(temperature !== undefined ? ["temperature"] : []), "providerOptions"],
      additionalProperties: false,
    },
    defaultOptions: {
      ...(temperature !== undefined ? { temperature } : {}),
      providerOptions: {
        vertex: { thinkingConfig: { thinkingLevel: defaultLevel, includeThoughts: true } },
      },
    },
  }
}

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
    ...temperatureOnlyOptions,
  },
  {
    model: AgentModel.Gemini25Pro,
    provider: AgentProvider.Vertex,
    deprecation: { deprecatedOn: "2026-09-30", recommendedReplacement: AgentModel.Gemini35Flash },
    servedOutsideEu: false,
    ...temperatureOnlyOptions,
  },
  ...[
    {
      model: AgentModel.Gemini31FlashLite,
      ...vertex3Options({ temperature: 1, levels: ALL_THINKING_LEVELS, defaultLevel: "minimal" }),
    },
    {
      model: AgentModel.Gemini35FlashLite,
      ...vertex3Options({ levels: ALL_THINKING_LEVELS, defaultLevel: "minimal" }),
    },
    {
      model: AgentModel.Gemini35Flash,
      ...vertex3Options({ temperature: 1, levels: ALL_THINKING_LEVELS, defaultLevel: "medium" }),
    },
    {
      model: AgentModel.Gemini36Flash,
      ...vertex3Options({ levels: ALL_THINKING_LEVELS, defaultLevel: "medium" }),
    },
    // Minimal was removed from 3.7 and up.
    {
      model: AgentModel.Gemini37Flash,
      ...vertex3Options({ levels: ["low", "medium", "high"], defaultLevel: "medium" }),
    },
    {
      model: AgentModel.Gemini38Flash,
      ...vertex3Options({ levels: ["low", "medium", "high"], defaultLevel: "medium" }),
    },
  ].map((entry) => ({
    ...entry,
    provider: AgentProvider.Vertex3,
    deprecation: null,
    servedOutsideEu: false,
  })),
  {
    model: AgentModel.MedGemma10_27B,
    provider: AgentProvider.MedGemma,
    deprecation: null,
    servedOutsideEu: false,
    ...temperatureOnlyOptions,
  },
  {
    model: AgentModel.Gemma4_26B,
    provider: AgentProvider.Gemma,
    deprecation: null,
    servedOutsideEu: false,
    ...temperatureOnlyOptions,
  },
  {
    model: AgentModel.MistralSmall31_24B,
    provider: AgentProvider.Mistral,
    deprecation: null,
    servedOutsideEu: false,
    ...temperatureOnlyOptions,
  },
]

/** The default options of a model, as the API sends them. */
function catalogDefaultOptions(model: string): Record<string, unknown> {
  return CATALOG.find((entry) => entry.model === model)?.defaultOptions ?? {}
}

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
    providerOptions:
      (params.providerOptions as Record<string, unknown> | undefined) ??
      catalogDefaultOptions(params.model ?? defaultAgentModels.agent),
    updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    usedProjectAgentSessionCategoryIds: params.usedProjectAgentSessionCategoryIds ?? [],
    mcpServers: params.mcpServers ?? [],
  } satisfies AgentSettings
})

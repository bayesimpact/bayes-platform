import { AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { Agent, AgentModelEntry, AgentModelsCatalog } from "./agents.models"

type AgentTransientParams = {
  project: Project
}

const AGENT_NAMES = [
  "Helpful Assistant",
  "Research Agent",
  "Drafting Helper",
  "Summary Bot",
  "Triage Assistant",
  "Support Agent",
]

class AgentFactory extends Factory<Agent, AgentTransientParams> {}

export const agentFactory = AgentFactory.define(({ params, transientParams }) => {
  const { project } = transientParams
  if (!project) {
    throw new Error("Project must be provided in transient params to build an Agent")
  }

  const types = ["conversation", "extraction"] as const
  return {
    createdAt: params.createdAt ?? faker.date.past().getTime(),
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? faker.helpers.arrayElement(AGENT_NAMES),
    projectId: project.id,
    type: params.type ?? faker.helpers.arrayElement(types),
    currentRevision: {
      name: params.currentRevision?.name,
      description: params.currentRevision?.description,
      updatedAt: params.currentRevision?.updatedAt ?? faker.date.recent().getTime(),
      number: params.currentRevision?.number ?? 1,
    },
    draftRevision: params.draftRevision
      ? {
          name: params.draftRevision.name,
          description: params.draftRevision.description,
          updatedAt: params.draftRevision.updatedAt ?? faker.date.recent().getTime(),
          number: params.draftRevision.number ?? 1,
        }
      : undefined,
  } satisfies Agent
})

/** The default models the API returns (a new agent, a new evaluation run's judge). */
export const defaultAgentModels: AgentModelsCatalog["defaults"] = {
  agent: AgentModel.Gemini35FlashLite,
  judge: AgentModel.Gemini35FlashLite,
}

const ALWAYS_AVAILABLE_PROVIDERS = [AgentProvider.Vertex, AgentProvider.Vertex3]

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
const CATALOG: Omit<AgentModelEntry, "isAvailable">[] = [
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

/** Models past their deprecation date: the API no longer offers them. */
const RETIRED_MODELS: AgentModel[] = [AgentModel.Gemini25Flash, AgentModel.Gemini25Pro]

/** The default options of a model, as the API sends them. */
export function catalogDefaultOptions(model: string): Record<string, unknown> {
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
    const availableProviders = [
      ...ALWAYS_AVAILABLE_PROVIDERS,
      ...(transientParams.flaggedProviders ?? []),
    ]
    return {
      models:
        (params.models as AgentModelEntry[] | undefined) ??
        CATALOG.map((entry) => ({
          ...entry,
          isAvailable:
            availableProviders.includes(entry.provider) && !RETIRED_MODELS.includes(entry.model),
        })),
      defaults: { ...defaultAgentModels, ...params.defaults },
    }
  },
)

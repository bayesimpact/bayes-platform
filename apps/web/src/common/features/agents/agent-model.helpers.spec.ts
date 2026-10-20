import { AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { HasFeature } from "@/common/hooks/use-feature-flags"
import { agentModelsCatalogFactory } from "./agent.factory"
import {
  agentModelDeprecationStage,
  buildAgentModelDeprecationInterpolation,
  buildAgentModelOptions,
  describeModelOptionFields,
  findAgentModelEntry,
  findModelOptionValue,
  formatAgentModelLabel,
  isPriorityCallsAvailable,
  readModelOption,
  writeModelOption,
} from "./agent-model.helpers"
import type { AgentModelsCatalog } from "./agents.models"

const catalog = agentModelsCatalogFactory.build()

/** The catalog with one model's entry changed, as the API would send it. */
const catalogWith = (
  model: AgentModel,
  change: Partial<AgentModelsCatalog["models"][number]>,
): AgentModelsCatalog => ({
  ...catalog,
  models: catalog.models.map((entry) => (entry.model === model ? { ...entry, ...change } : entry)),
})

describe("agent model catalog (as the API sends it)", () => {
  it("starts a new agent and judges a new evaluation run on Gemini 3.5 Flash-Lite", () => {
    expect(catalog.defaults).toEqual({
      agent: AgentModel.Gemini35FlashLite,
      judge: AgentModel.Gemini35FlashLite,
    })
  })

  it("lists every model but the test one", () => {
    expect(catalog.models.map((entry) => entry.model)).toEqual(
      Object.values(AgentModel).filter((model) => model !== AgentModel._Mock),
    )
  })

  it("never recommends a replacement that is itself deprecated", () => {
    const selfDefeating = catalog.models.filter((entry) => {
      const replacement = entry.deprecation?.recommendedReplacement
      return !!replacement && !!findAgentModelEntry(catalog, replacement)?.deprecation
    })

    expect(selfDefeating).toEqual([])
  })

  it("marks the gemini 2.5 models as deprecated on 2026-09-30", () => {
    expect(findAgentModelEntry(catalog, AgentModel.Gemini25Flash)?.deprecation).toEqual({
      deprecatedOn: "2026-09-30",
      recommendedReplacement: AgentModel.Gemini35FlashLite,
    })
    expect(findAgentModelEntry(catalog, AgentModel.Gemini25Pro)?.deprecation).toEqual({
      deprecatedOn: "2026-09-30",
      recommendedReplacement: AgentModel.Gemini35Flash,
    })
  })

  it("does not deprecate the default models", () => {
    expect(findAgentModelEntry(catalog, catalog.defaults.agent)?.deprecation).toBeNull()
    expect(findAgentModelEntry(catalog, catalog.defaults.judge)?.deprecation).toBeNull()
  })

  it("reports no model as served outside the EU", () => {
    expect(catalog.models.filter((entry) => entry.servedOutsideEu)).toEqual([])
  })
})

describe("findAgentModelEntry", () => {
  it("finds nothing for a model that left the catalog, an empty one, or no catalog yet", () => {
    // `agent_settings.model` is an unconstrained varchar, so a row can hold a model the catalog
    // dropped: reading it must answer "unknown", not throw.
    expect(findAgentModelEntry(catalog, "gemini-1.5-flash-retired")).toBeUndefined()
    expect(findAgentModelEntry(catalog, "")).toBeUndefined()
    expect(findAgentModelEntry(catalog, undefined)).toBeUndefined()
    expect(findAgentModelEntry(null, AgentModel.Gemini25Flash)).toBeUndefined()
  })
})

describe("buildAgentModelDeprecationInterpolation", () => {
  // Date formatting reads the UI language from `localStorage`, which these node-environment specs
  // do not provide.
  beforeEach(() => vi.stubGlobal("localStorage", { getItem: () => "en" }))
  afterEach(() => vi.unstubAllGlobals())

  it("names the model, its replacement and its retirement date", () => {
    const interpolation = buildAgentModelDeprecationInterpolation(AgentModel.Gemini25Pro, catalog)

    expect(interpolation).toMatchObject({
      model: AgentModel.Gemini25Pro,
      replacement: AgentModel.Gemini35Flash,
    })
    // The month name follows the UI locale; only the day and year are stable across languages.
    expect(interpolation?.date).toMatch(/^30 \S+ 2026$/)
  })

  it("names the replacement of the other deprecated model", () => {
    expect(
      buildAgentModelDeprecationInterpolation(AgentModel.Gemini25Flash, catalog),
    ).toMatchObject({
      model: AgentModel.Gemini25Flash,
      replacement: AgentModel.Gemini35FlashLite,
    })
  })

  it("returns undefined for a supported model, no model at all, or no catalog yet", () => {
    expect(buildAgentModelDeprecationInterpolation(catalog.defaults.agent, catalog)).toBeUndefined()
    expect(buildAgentModelDeprecationInterpolation(undefined, catalog)).toBeUndefined()
    expect(buildAgentModelDeprecationInterpolation(AgentModel.Gemini25Flash, null)).toBeUndefined()
  })
})

describe("agentModelDeprecationStage", () => {
  it("announces the retirement once the API no longer offers a deprecated model", () => {
    expect(agentModelDeprecationStage(AgentModel.Gemini25Flash, catalog)).toBe("retirement")
  })

  it("announces the deprecation while the API still offers the model", () => {
    expect(
      agentModelDeprecationStage(
        AgentModel.Gemini25Flash,
        catalogWith(AgentModel.Gemini25Flash, { isAvailable: true }),
      ),
    ).toBe("deprecation")
  })
})

describe("formatAgentModelLabel", () => {
  const labels = { deprecatedSuffix: "(deprecated)", nonEuSuffix: "(non-EU)" }

  it("labels every offered model", () => {
    const allFlags = agentModelsCatalogFactory
      .transient({
        flaggedProviders: [AgentProvider.MedGemma, AgentProvider.Gemma, AgentProvider.Mistral],
      })
      .build()

    expect(
      buildAgentModelOptions(allFlags).map((model) =>
        formatAgentModelLabel(model, allFlags, labels),
      ),
    ).toEqual([
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-3.8-flash",
      "google/medgemma-27b-it",
      "google/gemma-4-26b-A4B-it",
      "mistralai/Mistral-Small-3.1-24B-Instruct-2503",
    ])
  })

  it("marks a retired model as deprecated, for an agent still on it", () => {
    expect(formatAgentModelLabel(AgentModel.Gemini25Flash, catalog, labels)).toBe(
      "gemini-2.5-flash (deprecated)",
    )
  })

  it("appends the residency suffix to a model served outside the EU", () => {
    expect(
      formatAgentModelLabel(
        AgentModel.Gemini36Flash,
        catalogWith(AgentModel.Gemini36Flash, { servedOutsideEu: true }),
        labels,
      ),
    ).toBe("gemini-3.6-flash (non-EU)")
  })

  it("appends both suffixes when a model is deprecated and served outside the EU", () => {
    expect(
      formatAgentModelLabel(
        AgentModel.Gemini36Flash,
        catalogWith(AgentModel.Gemini36Flash, {
          servedOutsideEu: true,
          deprecation: {
            deprecatedOn: "2027-01-01",
            recommendedReplacement: AgentModel.Gemini35Flash,
          },
        }),
        labels,
      ),
    ).toBe("gemini-3.6-flash (deprecated) (non-EU)")
  })
})

describe("buildAgentModelOptions", () => {
  it("offers the vertex 3 models when the project has no flag", () => {
    expect(buildAgentModelOptions(catalog)).toEqual([
      AgentModel.Gemini31FlashLite,
      AgentModel.Gemini35FlashLite,
      AgentModel.Gemini35Flash,
      AgentModel.Gemini36Flash,
      AgentModel.Gemini37Flash,
      AgentModel.Gemini38Flash,
    ])
  })

  it("keeps the recommended replacements and the default models available", () => {
    const options = buildAgentModelOptions(catalog)
    const replacements = catalog.models.flatMap((entry) =>
      entry.deprecation ? [entry.deprecation.recommendedReplacement] : [],
    )

    for (const model of [...replacements, catalog.defaults.agent, catalog.defaults.judge]) {
      expect(options).toContain(model)
    }
  })

  it.each([
    [AgentProvider.MedGemma, AgentModel.MedGemma10_27B],
    [AgentProvider.Gemma, AgentModel.Gemma4_26B],
    [AgentProvider.Mistral, AgentModel.MistralSmall31_24B],
  ])("adds only the %s model once the API says it is available", (provider, model) => {
    const options = buildAgentModelOptions(
      agentModelsCatalogFactory.transient({ flaggedProviders: [provider] }).build(),
    )

    expect(options).toEqual([...buildAgentModelOptions(catalog), model])
  })
})

describe("describeModelOptionFields", () => {
  const fieldsOf = (model: AgentModel) =>
    describeModelOptionFields(findAgentModelEntry(catalog, model))
  const thinkingLevelPath = ["providerOptions", "vertex", "thinkingConfig", "thinkingLevel"]
  const temperature = { minimum: 0, maximum: 2 }

  it.each([
    AgentModel.Gemini25Flash,
    AgentModel.Gemini25Pro,
    AgentModel.MedGemma10_27B,
    AgentModel.Gemma4_26B,
    AgentModel.MistralSmall31_24B,
  ])("offers only a temperature for %s", (model) => {
    expect(fieldsOf(model)).toEqual({ temperature })
  })

  it.each([
    AgentModel.Gemini31FlashLite,
    AgentModel.Gemini35Flash,
  ])("offers a temperature and every thinking level for %s", (model) => {
    expect(fieldsOf(model)).toEqual({
      temperature,
      thinkingLevel: { path: thinkingLevelPath, levels: ["minimal", "low", "medium", "high"] },
    })
  })

  it.each([
    AgentModel.Gemini35FlashLite,
    AgentModel.Gemini36Flash,
  ])("offers only a thinking level for %s, whose temperature Google deprecated", (model) => {
    expect(fieldsOf(model)).toEqual({
      thinkingLevel: { path: thinkingLevelPath, levels: ["minimal", "low", "medium", "high"] },
    })
  })

  it.each([
    AgentModel.Gemini37Flash,
    AgentModel.Gemini38Flash,
  ])("offers the thinking levels %s accepts, without minimal", (model) => {
    expect(fieldsOf(model)).toEqual({
      thinkingLevel: { path: thinkingLevelPath, levels: ["low", "medium", "high"] },
    })
  })

  it("offers nothing for a model that left the catalog", () => {
    expect(describeModelOptionFields(undefined)).toEqual({})
  })
})

describe("readModelOption and writeModelOption", () => {
  const path = ["providerOptions", "vertex", "thinkingConfig", "thinkingLevel"]
  const options = {
    temperature: 1,
    providerOptions: {
      vertex: { thinkingConfig: { thinkingLevel: "medium", includeThoughts: true } },
    },
  }

  it("reads a nested option, and nothing on a missing path", () => {
    expect(readModelOption(options, path)).toBe("medium")
    expect(readModelOption(options, ["temperature"])).toBe(1)
    expect(readModelOption({}, path)).toBeUndefined()
    expect(readModelOption(null, ["temperature"])).toBeUndefined()
  })

  it("writes a nested option on a copy, keeping its siblings", () => {
    const written = writeModelOption(options, path, "high")

    expect(written).toEqual({
      temperature: 1,
      providerOptions: {
        vertex: { thinkingConfig: { thinkingLevel: "high", includeThoughts: true } },
      },
    })
    expect(readModelOption(options, path)).toBe("medium")
  })

  it("creates the path when the options have none", () => {
    expect(writeModelOption(null, ["temperature"], 0.5)).toEqual({ temperature: 0.5 })
  })
})

describe("findModelOptionValue", () => {
  const options = {
    temperature: 0.3,
    providerOptions: {
      vertex: { thinkingConfig: { thinkingLevel: "low", includeThoughts: true } },
    },
  }

  it("finds an option at the top level or nested by the provider", () => {
    expect(findModelOptionValue(options, "temperature")).toBe(0.3)
    expect(findModelOptionValue(options, "thinkingLevel")).toBe("low")
  })

  it("finds nothing in options that lack it, or in no options at all", () => {
    expect(findModelOptionValue({ temperature: 0 }, "thinkingLevel")).toBeUndefined()
    expect(findModelOptionValue(null, "temperature")).toBeUndefined()
  })
})

describe("isPriorityCallsAvailable", () => {
  const withPriorityFlag: HasFeature = (feature) => feature === "llm-priority-calls"

  it("is available for a Gemini 3.x model when the project has the flag", () => {
    expect(
      isPriorityCallsAvailable({ hasFeature: withPriorityFlag, model: AgentModel.Gemini35Flash }),
    ).toBe(true)
  })

  it("is hidden without the project flag", () => {
    expect(
      isPriorityCallsAvailable({ hasFeature: () => false, model: AgentModel.Gemini35Flash }),
    ).toBe(false)
  })

  it("is hidden for models outside the vertex 3 provider", () => {
    expect(
      isPriorityCallsAvailable({ hasFeature: withPriorityFlag, model: AgentModel.Gemini25Flash }),
    ).toBe(false)
    expect(isPriorityCallsAvailable({ hasFeature: withPriorityFlag, model: undefined })).toBe(false)
  })
})

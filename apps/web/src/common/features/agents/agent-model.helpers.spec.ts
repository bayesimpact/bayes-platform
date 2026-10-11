import { AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { HasFeature } from "@/common/hooks/use-feature-flags"
import {
  buildAgentModelDeprecationInterpolation,
  buildAgentModelOptions,
  findAgentModelEntry,
  formatAgentModelLabel,
  isPriorityCallsAvailable,
} from "./agent-model.helpers"
import { agentModelsCatalogFactory } from "./agent-settings/agent-settings.factory"
import type { AgentModelsCatalog } from "./agent-settings/agent-settings.models"

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
      "gemini-2.5-flash (deprecated)",
      "gemini-2.5-pro (deprecated)",
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
  it("offers the vertex and vertex 3 models when the project has no flag", () => {
    expect(buildAgentModelOptions(catalog)).toEqual([
      AgentModel.Gemini25Flash,
      AgentModel.Gemini25Pro,
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
  ])("adds only the %s model once the API says it is selectable", (provider, model) => {
    const options = buildAgentModelOptions(
      agentModelsCatalogFactory.transient({ flaggedProviders: [provider] }).build(),
    )

    expect(options).toEqual([...buildAgentModelOptions(catalog), model])
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

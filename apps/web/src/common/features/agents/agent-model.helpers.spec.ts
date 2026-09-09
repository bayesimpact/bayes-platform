import {
  AgentModel,
  AgentModelMetadataMap,
  DEFAULT_AGENT_MODEL,
  getAgentModelDeprecation,
  isAgentModelServedOutsideEu,
} from "@caseai-connect/api-contracts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { HasFeature } from "@/common/hooks/use-feature-flags"
import {
  buildAgentModelDeprecationInterpolation,
  buildAgentModelOptions,
  formatAgentModelLabel,
  isPriorityCallsAvailable,
} from "./agent-model.helpers"

describe("AgentModelMetadataMap", () => {
  it("has an entry for every model", () => {
    const missing = Object.values(AgentModel).filter((model) => !AgentModelMetadataMap[model])

    expect(missing).toEqual([])
  })

  it("never recommends a replacement that is itself deprecated", () => {
    const selfDefeating = Object.values(AgentModel).filter((model) => {
      const replacement = getAgentModelDeprecation(model)?.recommendedReplacement
      return !!replacement && !!getAgentModelDeprecation(replacement)
    })

    expect(selfDefeating).toEqual([])
  })

  it("uses ISO dates for every deprecation", () => {
    const badDates = Object.values(AgentModel)
      .map((model) => getAgentModelDeprecation(model)?.deprecatedOn)
      .filter((date) => date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date))

    expect(badDates).toEqual([])
  })

  it("marks the gemini 2.5 models as deprecated on 2026-09-30", () => {
    expect(getAgentModelDeprecation(AgentModel.Gemini25Flash)).toEqual({
      deprecatedOn: "2026-09-30",
      recommendedReplacement: AgentModel.Gemini35FlashLite,
    })
    expect(getAgentModelDeprecation(AgentModel.Gemini25Pro)).toEqual({
      deprecatedOn: "2026-09-30",
      recommendedReplacement: AgentModel.Gemini35Flash,
    })
  })

  it("does not deprecate the default model", () => {
    expect(getAgentModelDeprecation(DEFAULT_AGENT_MODEL)).toBeUndefined()
  })

  it("treats a model that is no longer in the enum as not deprecated", () => {
    // `agent_settings.model` is an unconstrained varchar, so a row can hold a model that has been
    // dropped from `AgentModel` (exactly what retiring the 2.5 models will produce). Reading the
    // catalog must answer "unknown", not throw — the banner renders inside the agent subtree and
    // there is no error boundary above it.
    expect(() => getAgentModelDeprecation("gemini-2.5-flash")).not.toThrow()
    expect(getAgentModelDeprecation("gemini-1.5-flash-retired")).toBeUndefined()
    expect(getAgentModelDeprecation("")).toBeUndefined()
  })

  it("reports no model as served outside the EU", () => {
    // Verified 2026-09-04: every Gemini 3.x model answers on the EU regional endpoint.
    const servedOutsideEu = Object.values(AgentModel).filter((model) =>
      isAgentModelServedOutsideEu(model),
    )

    expect(servedOutsideEu).toEqual([])
  })

  it("treats an unknown model as EU-served rather than throwing", () => {
    expect(() => isAgentModelServedOutsideEu("gemini-1.5-flash-retired")).not.toThrow()
    expect(isAgentModelServedOutsideEu("gemini-1.5-flash-retired")).toBe(false)
  })
})

describe("buildAgentModelDeprecationInterpolation", () => {
  // Date formatting reads the UI language from `localStorage`, which these node-environment specs
  // do not provide.
  beforeEach(() => vi.stubGlobal("localStorage", { getItem: () => "en" }))
  afterEach(() => vi.unstubAllGlobals())

  it("names the model, its replacement and its retirement date", () => {
    const interpolation = buildAgentModelDeprecationInterpolation(AgentModel.Gemini25Pro)

    expect(interpolation).toMatchObject({
      model: AgentModel.Gemini25Pro,
      replacement: AgentModel.Gemini35Flash,
    })
    // The month name follows the UI locale; only the day and year are stable across languages.
    expect(interpolation?.date).toMatch(/^30 \S+ 2026$/)
  })

  it("returns undefined for a supported model and for no model at all", () => {
    expect(buildAgentModelDeprecationInterpolation(DEFAULT_AGENT_MODEL)).toBeUndefined()
    expect(buildAgentModelDeprecationInterpolation(undefined)).toBeUndefined()
  })
})

describe("formatAgentModelLabel", () => {
  const labels = { deprecatedSuffix: "(deprecated)", nonEuSuffix: "(non-EU)" }

  it("appends the deprecated suffix to a deprecated model", () => {
    expect(formatAgentModelLabel(AgentModel.Gemini25Flash, labels)).toBe(
      "gemini-2.5-flash (deprecated)",
    )
  })

  it("leaves a supported EU-served model untouched", () => {
    expect(formatAgentModelLabel(AgentModel.Gemini35FlashLite, labels)).toBe(
      "gemini-3.5-flash-lite",
    )
  })

  it("appends the residency suffix to a model served outside the EU", () => {
    // No catalog entry carries the flag today, so it is seeded on the real catalog and restored.
    const metadata = AgentModelMetadataMap[AgentModel.Gemini36Flash]
    metadata.servedOutsideEu = true
    try {
      expect(formatAgentModelLabel(AgentModel.Gemini36Flash, labels)).toBe(
        "gemini-3.6-flash (non-EU)",
      )
    } finally {
      delete metadata.servedOutsideEu
    }
  })

  it("does not mark the other vertex 3 models as non-EU", () => {
    expect(formatAgentModelLabel(AgentModel.Gemini31FlashLite, labels)).toBe(
      "gemini-3.1-flash-lite",
    )
    expect(formatAgentModelLabel(AgentModel.Gemini35Flash, labels)).toBe("gemini-3.5-flash")
    expect(formatAgentModelLabel(AgentModel.Gemini36Flash, labels)).toBe("gemini-3.6-flash")
    expect(formatAgentModelLabel(AgentModel.Gemini38Flash, labels)).toBe("gemini-3.8-flash")
  })

  it("appends both suffixes when a model is deprecated and served outside the EU", () => {
    // No catalog entry carries either fact today, so both are seeded on the real catalog and
    // restored: the assertion is about the formatter, not about the current data.
    const metadata = AgentModelMetadataMap[AgentModel.Gemini36Flash]
    const originalDeprecation = metadata.deprecation
    metadata.servedOutsideEu = true
    metadata.deprecation = {
      deprecatedOn: "2027-01-01",
      recommendedReplacement: AgentModel.Gemini35Flash,
    }

    try {
      expect(formatAgentModelLabel(AgentModel.Gemini36Flash, labels)).toBe(
        "gemini-3.6-flash (deprecated) (non-EU)",
      )
    } finally {
      metadata.deprecation = originalDeprecation
      delete metadata.servedOutsideEu
    }
  })
})

describe("buildAgentModelOptions", () => {
  const noFlags: HasFeature = () => false

  it("always offers the vertex and vertex 3 models", () => {
    expect(buildAgentModelOptions(noFlags)).toEqual([
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

  it("keeps the recommended replacements available with no flags enabled", () => {
    const options = buildAgentModelOptions(noFlags)
    const replacements = Object.values(AgentModel)
      .map((model) => getAgentModelDeprecation(model)?.recommendedReplacement)
      .filter((replacement) => replacement !== undefined)

    for (const replacement of replacements) {
      expect(options).toContain(replacement)
    }
  })

  it("adds a flagged provider's models only when its flag is on", () => {
    const options = buildAgentModelOptions((feature) => feature === "mistral")

    expect(options).toContain(AgentModel.MistralSmall31_24B)
    expect(options).not.toContain(AgentModel.Gemma4_26B)
    expect(options).not.toContain(AgentModel.MedGemma10_27B)
  })

  it("never offers the mock model", () => {
    expect(buildAgentModelOptions(() => true)).not.toContain(AgentModel._Mock)
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

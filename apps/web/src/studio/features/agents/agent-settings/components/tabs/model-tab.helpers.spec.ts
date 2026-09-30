import {
  AgentModel,
  DEFAULT_EMBEDDING_MODEL,
  type UpdateAgentSettingsModelDto,
} from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import { agentFactory, agentModelsCatalogFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import {
  buildModelTabDefaultValues,
  buildModelTabSubmit,
  defaultModelOptions,
  modelOptionsForPickedModel,
} from "./model-tab.helpers"

const catalog = agentModelsCatalogFactory.build()
const thinkingOptions = (thinkingLevel: string) => ({
  providerOptions: { vertex: { thinkingConfig: { thinkingLevel, includeThoughts: true } } },
})

describe("defaultModelOptions", () => {
  it.each([
    [AgentModel.Gemini25Flash, { temperature: 0 }],
    [AgentModel.Gemini35Flash, { temperature: 1, ...thinkingOptions("medium") }],
    [AgentModel.Gemini37Flash, thinkingOptions("medium")],
  ])("starts %s on its default options", (model, options) => {
    expect(defaultModelOptions(catalog, model)).toEqual(options)
  })

  it("has no options for a model that left the catalog", () => {
    expect(defaultModelOptions(catalog, "gemini-1.5-flash-retired")).toEqual({})
  })
})

describe("modelOptionsForPickedModel", () => {
  const agentSettings = {
    model: AgentModel.Gemini31FlashLite,
    providerOptions: { temperature: 0.2, ...thinkingOptions("low") },
  }

  it("starts another model on its default options", () => {
    expect(
      modelOptionsForPickedModel({ catalog, agentSettings, model: AgentModel.Gemini35Flash }),
    ).toEqual({ temperature: 1, ...thinkingOptions("medium") })
  })

  it("gives back the agent's own options when it goes back to the agent's model", () => {
    expect(
      modelOptionsForPickedModel({ catalog, agentSettings, model: AgentModel.Gemini31FlashLite }),
    ).toEqual({ temperature: 0.2, ...thinkingOptions("low") })
  })
})

describe("buildModelTabDefaultValues", () => {
  const organization = organizationFactory.build()
  const project = projectFactory.transient({ organization }).build()
  const agent = agentFactory.transient({ project }).build()

  it("starts from the agent's model, model options and priority tier", () => {
    const agentSettings = agentSettingsFactory.transient({ agent }).build({
      model: AgentModel.Gemini35Flash,
      providerOptions: { temperature: 0.4, ...thinkingOptions("low") },
      priorityCallsEnabled: true,
    })

    expect(buildModelTabDefaultValues(agentSettings)).toEqual({
      model: AgentModel.Gemini35Flash,
      providerOptions: { temperature: 0.4, ...thinkingOptions("low") },
      priorityCallsEnabled: true,
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
    })
  })

  it("builds an agent on its model's default options", () => {
    const agentSettings = agentSettingsFactory
      .transient({ agent })
      .build({ model: AgentModel.Gemini36Flash })

    expect(agentSettings.providerOptions).toEqual(thinkingOptions("medium"))
  })
})

describe("buildModelTabSubmit", () => {
  const values: UpdateAgentSettingsModelDto = {
    model: AgentModel.Gemini35Flash,
    providerOptions: { temperature: 1, ...thinkingOptions("medium") },
    priorityCallsEnabled: false,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
  }

  it("saves only the fields the user changed", () => {
    expect(
      buildModelTabSubmit({
        values,
        dirtyFields: { model: true },
        priorityCallsAvailable: true,
      }),
    ).toEqual({ fields: { model: AgentModel.Gemini35Flash }, resetValues: values })
  })

  it("saves the model options once the user changed one of them", () => {
    expect(
      buildModelTabSubmit({
        values,
        dirtyFields: { providerOptions: { temperature: true } },
        priorityCallsAvailable: true,
      }).fields,
    ).toEqual({ providerOptions: values.providerOptions })
  })

  it("switches the priority tier off when the picked model cannot offer it", () => {
    const withPriority = { ...values, model: AgentModel.Gemini25Flash, priorityCallsEnabled: true }

    expect(
      buildModelTabSubmit({
        values: withPriority,
        dirtyFields: { model: true },
        priorityCallsAvailable: false,
      }),
    ).toEqual({
      fields: { model: AgentModel.Gemini25Flash, priorityCallsEnabled: false },
      resetValues: { ...withPriority, priorityCallsEnabled: false },
    })
  })

  it("keeps the priority tier when the picked model offers it", () => {
    const withPriority = { ...values, priorityCallsEnabled: true }

    expect(
      buildModelTabSubmit({
        values: withPriority,
        dirtyFields: { priorityCallsEnabled: true },
        priorityCallsAvailable: true,
      }),
    ).toEqual({ fields: { priorityCallsEnabled: true }, resetValues: withPriority })
  })
})

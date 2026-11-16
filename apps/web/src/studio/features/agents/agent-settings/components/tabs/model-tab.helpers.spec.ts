import {
  AgentModel,
  EmbeddingModel,
  type UpdateAgentSettingsModelDto,
} from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import { agentFactory, agentModelsCatalogFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import {
  buildModelTabDefaultValues,
  buildModelTabFields,
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
      embeddingModel: EmbeddingModel.GeminiEmbedding001,
    })
  })

  it("builds an agent on its model's default options", () => {
    const agentSettings = agentSettingsFactory
      .transient({ agent })
      .build({ model: AgentModel.Gemini36Flash })

    expect(agentSettings.providerOptions).toEqual(thinkingOptions("medium"))
  })
})

describe("buildModelTabFields", () => {
  const values: UpdateAgentSettingsModelDto = {
    model: AgentModel.Gemini35Flash,
    providerOptions: { temperature: 1, ...thinkingOptions("medium") },
    priorityCallsEnabled: false,
    embeddingModel: EmbeddingModel.GeminiEmbedding001,
  }

  it("saves only the fields the user changed", () => {
    expect(
      buildModelTabFields({
        values,
        changed: { model: values.model },
        priorityCallsAvailable: true,
      }),
    ).toEqual({ model: AgentModel.Gemini35Flash })
  })

  it("switches the priority tier off when the picked model cannot offer it", () => {
    const withPriority = { ...values, model: AgentModel.Gemini25Flash, priorityCallsEnabled: true }

    expect(
      buildModelTabFields({
        values: withPriority,
        changed: { model: withPriority.model },
        priorityCallsAvailable: false,
      }),
    ).toEqual({ model: AgentModel.Gemini25Flash, priorityCallsEnabled: false })
  })

  it("keeps the priority tier on when the model offers it", () => {
    const withPriority = { ...values, priorityCallsEnabled: true }

    expect(
      buildModelTabFields({
        values: withPriority,
        changed: { model: withPriority.model },
        priorityCallsAvailable: true,
      }),
    ).toEqual({ model: withPriority.model })
  })
})

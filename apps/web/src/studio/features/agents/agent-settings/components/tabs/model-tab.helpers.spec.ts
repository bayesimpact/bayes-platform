import { AgentModel, type UpdateAgentSettingsModelDto } from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { buildModelTabDefaultValues, buildModelTabSubmit } from "./model-tab.helpers"

describe("buildModelTabDefaultValues", () => {
  const organization = organizationFactory.build()
  const project = projectFactory.transient({ organization }).build()
  const agent = agentFactory.transient({ project }).build()

  it("starts from the agent's model, temperature and priority tier", () => {
    const agentSettings = agentSettingsFactory.transient({ agent }).build({
      model: AgentModel.Gemini35Flash,
      deletedTemperature: 0.4,
      priorityCallsEnabled: true,
    })

    expect(buildModelTabDefaultValues(agentSettings)).toEqual({
      model: AgentModel.Gemini35Flash,
      deletedTemperature: 0.4,
      priorityCallsEnabled: true,
    })
  })
})

describe("buildModelTabSubmit", () => {
  const values: UpdateAgentSettingsModelDto = {
    model: AgentModel.Gemini35Flash,
    deletedTemperature: 0,
    priorityCallsEnabled: false,
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

import { AgentModel } from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import {
  buildCreateRunPayload,
  buildDefaultRunFormValues,
  type RunFormValues,
} from "./evaluation-conversation-runs.helpers"

describe("buildDefaultRunFormValues", () => {
  it("starts with no agent, the whole dataset, and the given default judge", () => {
    expect(buildDefaultRunFormValues(AgentModel.Gemini35FlashLite)).toEqual({
      agentId: "",
      selectedRevision: null,
      judgeModel: AgentModel.Gemini35FlashLite,
      judgeInstructions: "",
      runScope: "all",
      limitedCount: 1,
    })
  })

  it("returns a fresh object each time, so a reset never reuses edited values", () => {
    expect(buildDefaultRunFormValues(AgentModel.Gemini35FlashLite)).not.toBe(
      buildDefaultRunFormValues(AgentModel.Gemini35FlashLite),
    )
  })
})

describe("buildCreateRunPayload", () => {
  const values: RunFormValues = {
    agentId: "agent-id",
    selectedRevision: 3,
    judgeModel: AgentModel.Gemini35Flash,
    judgeInstructions: "  Be strict.  ",
    runScope: "all",
    limitedCount: 5,
  }

  it("sends the chosen judge model, revision and trimmed instructions", () => {
    expect(buildCreateRunPayload({ datasetId: "dataset-id", values })).toEqual({
      datasetId: "dataset-id",
      agentId: "agent-id",
      agentSettingsRevision: 3,
      judgeModel: AgentModel.Gemini35Flash,
      judgeInstructions: "Be strict.",
      recordLimit: null,
    })
  })

  it("sends blank instructions as none", () => {
    expect(
      buildCreateRunPayload({
        datasetId: "dataset-id",
        values: { ...values, judgeInstructions: "  " },
      })?.judgeInstructions,
    ).toBeNull()
  })

  it("limits the records only for a limited run", () => {
    expect(
      buildCreateRunPayload({ datasetId: "dataset-id", values: { ...values, runScope: "limited" } })
        ?.recordLimit,
    ).toBe(5)
  })

  it("creates nothing until a revision is picked", () => {
    expect(
      buildCreateRunPayload({
        datasetId: "dataset-id",
        values: { ...values, selectedRevision: null },
      }),
    ).toBeUndefined()
  })
})

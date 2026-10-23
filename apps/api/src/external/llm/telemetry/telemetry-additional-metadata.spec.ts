import { telemetryAdditionalMetadata } from "@/external/llm/telemetry/telemetry-additional-metadata"

describe("telemetryAdditionalMetadata", () => {
  it("describes the agent from its entity and its settings", () => {
    expect(
      telemetryAdditionalMetadata({
        agent: { name: "Helpful Assistant", type: "conversation" },
        agentSettings: { revision: 3 },
        agentClass: "parent-agent",
      }),
    ).toEqual({
      agent: {
        name: "Helpful Assistant",
        revision: 3,
        type: "conversation",
        class: "parent-agent",
      },
    })
  })

  it("adds the agent that called a sub-agent, with the trace of its run", () => {
    const metadata = telemetryAdditionalMetadata({
      agent: { name: "Support", type: "conversation" },
      agentSettings: { revision: 1 },
      agentClass: "sub-agent",
      parent: {
        agent: { name: "Helpful Assistant", type: "conversation" },
        agentSettings: { revision: 3 },
        trace: "parent-trace-id",
      },
    })

    expect(metadata.agent?.parent).toEqual({
      name: "Helpful Assistant",
      revision: 3,
      type: "conversation",
      trace: "parent-trace-id",
    })
  })

  it("sets the run, test and environment levels it is given, and leaves out the others", () => {
    expect(
      telemetryAdditionalMetadata({ agent: { type: "Rating Agent" }, runTag: "batch" }),
    ).toEqual({
      agent: { type: "Rating Agent" },
      run: { tag: "batch" },
    })
    expect(
      telemetryAdditionalMetadata({
        model: "mock",
        test: { name: "live-provider-regressions", case: "rag" },
        environment: "**TEST**",
      }),
    ).toEqual({
      agent: { model: "mock" },
      test: { name: "live-provider-regressions", case: "rag" },
      environment: "**TEST**",
    })
  })
})

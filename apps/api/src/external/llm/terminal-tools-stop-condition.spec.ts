import type { StepResult, ToolSet } from "ai"
import { terminalToolsStopCondition } from "@/external/llm/terminal-tools-stop-condition"

function buildStep({
  text = "",
  toolNames = [],
}: {
  text?: string
  toolNames?: string[]
}): StepResult<ToolSet> {
  return {
    text,
    toolCalls: toolNames.map((toolName) => ({ toolName })),
  } as unknown as StepResult<ToolSet>
}

describe("terminalToolsStopCondition", () => {
  const condition = terminalToolsStopCondition({ terminalToolNames: ["take_over_form"] })

  it("keeps going while no terminal tool ran", async () => {
    const steps = [buildStep({ toolNames: ["lookup_knowledge_base"] }), buildStep({ text: "Hi" })]
    expect(await condition({ steps })).toBe(false)
  })

  it("stops on the hand-over step when it already carries the closing sentence", async () => {
    const steps = [buildStep({ text: "I hand you over.", toolNames: ["take_over_form"] })]
    expect(await condition({ steps })).toBe(true)
  })

  it("allows one more generation for the sentence, then stops", async () => {
    const handOver = buildStep({ toolNames: ["take_over_form"] })
    expect(await condition({ steps: [handOver] })).toBe(false)
    expect(await condition({ steps: [handOver, buildStep({ text: "I hand you over." })] })).toBe(
      true,
    )
  })

  it("stops after the extra generation even when the model called other tools instead of writing", async () => {
    const steps = [
      buildStep({ toolNames: ["take_over_form"] }),
      buildStep({ toolNames: ["take_over_other"] }),
    ]
    expect(await condition({ steps })).toBe(true)
  })
})

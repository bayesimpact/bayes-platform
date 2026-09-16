import { tool } from "ai"
import { z } from "zod"
import { withStrictTools } from "./strict-tools"

describe("withStrictTools", () => {
  it("marks every tool strict", () => {
    const tools = withStrictTools({
      alpha: tool({ description: "a", inputSchema: z.object({}) }),
      beta: tool({ description: "b", inputSchema: z.object({}) }),
    })

    expect(tools?.alpha?.strict).toBe(true)
    expect(tools?.beta?.strict).toBe(true)
  })

  it("preserves getter-based dynamic properties instead of materializing them", () => {
    // A tool may expose description/inputSchema as getters that follow the
    // turn state: the strict wrapper must keep re-evaluating them, not
    // snapshot them at wrap time.
    let lookupRan = false
    const dynamicTool = tool({
      get description() {
        return lookupRan ? "with chunks" : "without chunks"
      },
      inputSchema: z.object({}),
      execute: async () => "executed",
    })

    const wrapped = withStrictTools({ summary: dynamicTool })?.summary
    expect(wrapped?.description).toBe("without chunks")

    lookupRan = true
    expect(wrapped?.description).toBe("with chunks")
    expect(wrapped?.strict).toBe(true)
  })

  it("keeps execute callable and returns undefined for undefined tool sets", async () => {
    const wrapped = withStrictTools({
      alpha: tool({
        description: "a",
        inputSchema: z.object({}),
        execute: async () => "ran",
      }),
    })
    await expect(wrapped?.alpha?.execute?.({}, {} as never)).resolves.toBe("ran")

    expect(withStrictTools(undefined)).toBeUndefined()
  })

  it("does not mutate the original tools", () => {
    const original = tool({ description: "a", inputSchema: z.object({}) })
    withStrictTools({ alpha: original })

    expect(original.strict).toBeUndefined()
  })
})

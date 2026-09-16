import { tool } from "@ai-sdk/provider-utils"
import type { ToolSet } from "ai"
import { z } from "zod"
import { zNullableType } from "@/common/zod-helper"
import { GemmaPromptHelper } from "@/external/llm/providers/gemma/gemma-prompt-helper"

describe("GemmaPromptHelper", () => {
  const inputSchema = z.object({
    stringVal: zNullableType(z.string(), "String"),
    boolVal: zNullableType(z.boolean(), "Boolean"),
    intVal: zNullableType(z.int(), "Int"),
    numberVal: zNullableType(z.number(), "Number"),
  })
  const outputSchema = z.object({
    stringOutVal: zNullableType(z.string(), "Out String"),
    boolOutVal: zNullableType(z.boolean(), "Out Boolean"),
    intOutVal: zNullableType(z.int(), "Out Int"),
    numberOutVal: zNullableType(z.number(), "Out Number"),
  })
  const testTool = tool({
    description: "A test tool",
    inputSchema,
    outputSchema,
    execute: async (input, _options) => {
      return {
        stringOutVal: input.stringVal,
        boolOutVal: input.boolVal,
        intOutVal: input.intVal,
        numberOutVal: input.numberVal,
      }
    },
  })
  const testTools = { test: testTool } as ToolSet
  it("injectToolCallInstructions - returns prompt unchanged when marker is absent", async () => {
    const initialPrompt = "initial prompt"
    const result = GemmaPromptHelper.injectToolCallInstructions({
      prompt: initialPrompt,
      tools: testTools,
    })
    expect(result).toBe(initialPrompt)
  })
  it("injectToolCallInstructions - returns prompt unchanged when no tools", async () => {
    const prompt = `some text\n## Response language:\nAlways answer in English.`
    const result = GemmaPromptHelper.injectToolCallInstructions({
      prompt,
      tools: {} as ToolSet,
    })
    expect(result).toBe(prompt)
  })
  it("injectToolCallInstructions - injects CRITICAL instruction before language marker", async () => {
    const prompt = `some text\n## Response language:\nAlways answer in English.`
    const result = GemmaPromptHelper.injectToolCallInstructions({ prompt, tools: testTools })
    expect(result).toContain("(CRITICAL)")
    expect(result).toContain("## Response language:\nAlways answer in")
    expect(result.indexOf("(CRITICAL)")).toBeLessThan(result.indexOf("## Response language:"))
  })
  it("injectToolCallInstructions - does not describe the tools in the prompt", async () => {
    const prompt = `some text\n## Response language:\nAlways answer in English.`
    const result = GemmaPromptHelper.injectToolCallInstructions({ prompt, tools: testTools })
    // Gemma receives tool definitions through native function calling, never in
    // the prompt. Guards against reintroducing the Mistral-style tool listing.
    expect(result).not.toContain("A test tool")
    expect(result).not.toContain("##TOOLS")
  })
  it("injectToolCallInstructions - asks for grouped calls only when several tools are declared", async () => {
    const prompt = `some text\n## Response language:\nAlways answer in English.`
    const single = GemmaPromptHelper.injectToolCallInstructions({ prompt, tools: testTools })
    expect(single).not.toContain(GemmaPromptHelper.GROUPED_TOOL_CALLS_INSTRUCTION)

    const several = GemmaPromptHelper.injectToolCallInstructions({
      prompt,
      tools: { test: testTool, other: testTool } as ToolSet,
    })
    expect(several).toContain(GemmaPromptHelper.GROUPED_TOOL_CALLS_INSTRUCTION)
    // Both instructions sit right before the language marker, grouped-calls
    // line FIRST: after the null rule it stops working (measured, see the
    // helper doc comment).
    expect(several.indexOf(GemmaPromptHelper.GROUPED_TOOL_CALLS_INSTRUCTION)).toBeLessThan(
      several.indexOf("(CRITICAL)"),
    )
    expect(several.indexOf("(CRITICAL)")).toBeLessThan(several.indexOf("## Response language:"))
  })
  it("jsonSchemaToArgumentString", async () => {
    const schema1 = z.object({
      stringVal: zNullableType(z.string(), "String"),
      boolVal: zNullableType(z.boolean(), "Boolean"),
      intVal: zNullableType(z.int(), "Int"),
      numberVal: zNullableType(z.number(), "Number"),
    })
    let result = GemmaPromptHelper.jsonSchemaToArgumentString(schema1)
    expect(result).toBeDefined()
    expect(result).toBe(
      "{ stringVal: string | null; boolVal: boolean | null; intVal: number | null; numberVal: number | null }",
    )

    const schema2 = z.object({
      stringVal: zNullableType(z.string(), "String"),
      objVal: z.object({
        boolVal: zNullableType(z.boolean(), "Boolean"),
        intVal: zNullableType(z.int(), "Int"),
        numberVal: zNullableType(z.number(), "Number"),
      }),
    })
    result = GemmaPromptHelper.jsonSchemaToArgumentString(schema2)
    expect(result).toBeDefined()
    expect(result).toBe(
      "{ stringVal: string | null; objVal: { boolVal: boolean | null; intVal: number | null; numberVal: number | null } }",
    )
  })
})

import { tool } from "@ai-sdk/provider-utils"
import type { ToolSet } from "ai"
import { z } from "zod"
import { zNullableType } from "@/common/zod-helper"
import { MistralPromptHelper } from "@/external/llm/providers/mistral/mistral-prompt-helper"

describe("MistralPromptHelper", () => {
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
  it("appendToolsToPrompt", async () => {
    const initialPrompt = "initial prompt"
    const result = MistralPromptHelper.appendToolsToPrompt({
      prompt: initialPrompt,
      tools: testTools,
    })
    expect(result).toBeDefined()
    expect(result).toContain(initialPrompt)
    expect(result).toContain("##TOOLS")
    expect(result).toContain("You have access to the following tools:")
    expect(result).toContain("test: A test tool")
    expect(result).toContain(
      "Parameters: { stringVal: string | null; boolVal: boolean | null; intVal: number | null; numberVal: number | null }",
    )
  })
  it("convertToolsToDocs", async () => {
    const results = MistralPromptHelper.convertToolsToDocs(testTools)
    expect(results).toBeDefined()
    expect(results?.length).toBe(1)
    const result = results ? results[0] : ""
    expect(result).toContain("test: A test tool")
    expect(result).toContain(
      "Parameters: { stringVal: string | null; boolVal: boolean | null; intVal: number | null; numberVal: number | null }",
    )
  })
  it("jsonSchemaToArgumentString", async () => {
    const schema1 = z.object({
      stringVal: zNullableType(z.string(), "String"),
      boolVal: zNullableType(z.boolean(), "Boolean"),
      intVal: zNullableType(z.int(), "Int"),
      numberVal: zNullableType(z.number(), "Number"),
    })
    let result = MistralPromptHelper.jsonSchemaToArgumentString(schema1)
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
    result = MistralPromptHelper.jsonSchemaToArgumentString(schema2)
    expect(result).toBeDefined()
    expect(result).toBe(
      "{ stringVal: string | null; objVal: { boolVal: boolean | null; intVal: number | null; numberVal: number | null } }",
    )
  })
})

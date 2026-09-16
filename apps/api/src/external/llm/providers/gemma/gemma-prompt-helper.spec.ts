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
  const _testTools = { test: testTool } as ToolSet
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

import { describe, expect, it, jest } from "@jest/globals"
import type { LLMMetadata, LLMProvider } from "@/common/interfaces/llm-provider.interface"
import {
  buildConsolidationPrompt,
  buildConsolidationSchema,
  handoffTranscriptWindow,
  pickMissingFields,
  runFormConsolidation,
  type TranscriptMessage,
} from "./form-consolidation"

const schema = {
  type: "object" as const,
  properties: {
    forName: { type: "string" as const, description: "First name" },
    age: { type: "number" as const, description: "Age" },
    region: { type: "string" as const, description: "Region", enum: ["North", "South"] },
    consent: { type: "boolean" as const },
  },
}

const metadata = {
  traceId: "trace",
  agentSessionId: "session",
  agentId: "child",
  revision: 1,
  projectId: "project",
  organizationId: "organization",
  currentTurn: 2,
  tags: ["child"],
} as LLMMetadata

describe("handoffTranscriptWindow", () => {
  const messages: TranscriptMessage[] = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Passing you to Identity.", agentId: "parent" },
    { role: "user", content: "Ok" },
    { role: "assistant", content: "What is your first name?", agentId: "child" },
    { role: "user", content: "John, I am 42" },
    { role: "assistant", content: "Thanks, goodbye!", agentId: "child" },
  ]

  it("starts at the user message the sub-agent's first reply answers and keeps only its part", () => {
    expect(handoffTranscriptWindow(messages, "child").map((message) => message.content)).toEqual([
      "Ok",
      "What is your first name?",
      "John, I am 42",
      "Thanks, goodbye!",
    ])
  })

  it("is empty when the sub-agent never replied", () => {
    expect(handoffTranscriptWindow(messages, "other")).toEqual([])
  })
})

describe("buildConsolidationSchema", () => {
  it("makes every field nullable and required, with the enum kept", () => {
    const built = buildConsolidationSchema(schema) as {
      properties: Record<string, { type: unknown; enum?: unknown }>
      required: string[]
    }
    expect(built.required).toEqual(["forName", "age", "region", "consent"])
    expect(built.properties.forName?.type).toEqual(["string", "null"])
    expect(built.properties.age?.type).toEqual(["number", "null"])
    expect(built.properties.region?.enum).toEqual(["North", "South", null])
    expect(built.properties.consent?.type).toEqual(["boolean", "null"])
  })
})

describe("buildConsolidationPrompt", () => {
  it("lists the fields with their hints and the transcript with the speakers", () => {
    const { systemPrompt, userContent } = buildConsolidationPrompt({
      schema,
      agentName: "Identity",
      transcript: [
        { role: "user", content: "John" },
        { role: "assistant", content: "Thanks", agentId: "child" },
      ],
    })
    expect(systemPrompt).toContain("null when the user did not state it")
    expect(userContent).toContain("- region: Region (one of: North, South)")
    expect(userContent).toContain("user: John")
    expect(userContent).toContain("Identity: Thanks")
  })
})

describe("pickMissingFields", () => {
  it("adds the extracted fields the form left empty and never overwrites a filled one", () => {
    expect(
      pickMissingFields({
        state: { forName: "John", region: "", consent: null },
        extracted: { forName: "Johnny", age: "42", region: "North", consent: true },
      }),
    ).toEqual({ age: 42, region: "North", consent: true })
  })

  it("ignores empty extractions", () => {
    expect(
      pickMissingFields({
        state: {},
        extracted: { forName: null, age: "null", region: "", consent: undefined },
      }),
    ).toEqual({})
  })
})

describe("runFormConsolidation", () => {
  const buildConfig = (systemPrompt: string) => ({ systemPrompt }) as never

  it("asks the model for the missing fields only when some are missing, and returns the additions", async () => {
    const generateStructuredOutput = jest.fn(async () => ({
      forName: "Johnny",
      age: 42,
      region: null,
      consent: null,
    }))
    const added = await runFormConsolidation({
      provider: { generateStructuredOutput } as unknown as LLMProvider,
      buildConfig,
      metadata,
      schema,
      transcript: [{ role: "user", content: "John, 42" }],
      state: { forName: "John" },
      agentName: "Identity",
    })
    expect(added).toEqual({ age: 42 })
    const calls = generateStructuredOutput.mock.calls as unknown as Array<
      [{ metadata: LLMMetadata }]
    >
    const call = calls[0]?.[0]
    if (!call) throw new Error("the model was not called")
    expect(call.metadata.tags).toContain("form-consolidation")
    expect(call.metadata.spanLabel).toBe("consolidation")
  })

  it("does nothing when the form is complete or the transcript empty", async () => {
    const generateStructuredOutput = jest.fn(async () => ({}))
    const provider = { generateStructuredOutput } as unknown as LLMProvider
    await runFormConsolidation({
      provider,
      buildConfig,
      metadata,
      schema,
      transcript: [],
      state: {},
      agentName: "Identity",
    })
    await runFormConsolidation({
      provider,
      buildConfig,
      metadata,
      schema,
      transcript: [{ role: "user", content: "x" }],
      state: { forName: "a", age: 1, region: "North", consent: false },
      agentName: "Identity",
    })
    expect(generateStructuredOutput).not.toHaveBeenCalled()
  })

  it("adds nothing when the model call fails", async () => {
    const generateStructuredOutput = jest.fn(async () => {
      throw new Error("boom")
    })
    const added = await runFormConsolidation({
      provider: { generateStructuredOutput } as unknown as LLMProvider,
      buildConfig,
      metadata,
      schema,
      transcript: [{ role: "user", content: "x" }],
      state: {},
      agentName: "Identity",
    })
    expect(added).toEqual({})
  })
})

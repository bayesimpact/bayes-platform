import { AgentModel } from "@caseai-connect/api-contracts"
import { afterAll, beforeAll, beforeEach } from "@jest/globals"
import { tool } from "ai"
import { v4 } from "uuid"
import { z } from "zod"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMFile,
  LLMMetadata,
} from "@/common/interfaces/llm-provider.interface"
import { sdk } from "@/external/llm/open-telemetry-init"
import { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"

describe("AISDKMockProvider", () => {
  let provider: AISDKMockProvider
  let messages: LLMChatMessage[]
  let config: LLMConfig
  let metadata: LLMMetadata
  beforeAll(async () => {
    provider = new AISDKMockProvider()
    messages = [{ role: "user", content: "for test purpose" }]
    config = { model: AgentModel._Mock, temperature: 1, systemPrompt: "" }
    metadata = {
      agentId: "agentId",
      agentSessionId: "agentSessionId",
      currentTurn: 0,
      organizationId: "organizationId",
      projectId: "projectId",
      tags: ["**TEST**"],
      traceId: "traceId",
      revision: 1,
    }
  })
  beforeEach(() => {
    provider.resetMock()
    metadata.traceId = v4()
  })
  afterAll(async () => {
    await sdk.shutdown()
  })

  it("streamChatResponse - default mock value", async () => {
    const stream = provider.streamChatResponse({ messages, config, metadata })
    const results = await streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    expect(results.join("")).toBe("Hello, I'm the stream default mock value!")
  })

  it("generateText - default mock value", async () => {
    const result = await provider.generateText({ prompt: "", config, metadata })
    expect(result).toBe("Hello, I'm the text default mock value!")
  })

  it("generateObject - default mock value", async () => {
    const schema = z.object({ content: z.string(), source: z.string() })
    const result = await provider.generateObject({ schema, prompt: "", config, metadata })
    expect(() => schema.parse(result)).not.toThrow()
    const parsed = schema.parse(result)
    expect(parsed.source).toBe("source-value")
    expect(parsed.content).toBe("content-value")
  })

  it("generateStructuredOutput - default mock value", async () => {
    const schema = z.object({ content: z.string(), source: z.string() })
    const testFile: LLMFile = {
      type: "file",
      name: "file1.pdf",
      mediaType: "application/pdf",
      content: Buffer.from("%PDF-1.4\n%%EOF"),
    }
    const message: LLMChatMessage = {
      role: "user",
      content: [
        { type: "text", text: "" },
        {
          type: testFile.type as "file",
          mediaType: testFile.mediaType,
          data: testFile.content,
          filename: testFile.name,
        },
      ],
    }

    const result = await provider.generateStructuredOutput({
      message,
      schema: schema.toJSONSchema(),
      config,
      metadata,
    })
    expect(() => schema.parse(result)).not.toThrow()
    const parsed = schema.parse(result)
    expect(parsed.source).toBe("source-value")
    expect(parsed.content).toBe("content-value")
  })

  it("addTextTurn - returns the specified value", async () => {
    provider.addTextTurn(metadata.agentId, "76")
    const result = await provider.generateText({ prompt: "", config, metadata })
    expect(result).toBe("76")
  })

  it("addTextTurn - returns the specified values in order", async () => {
    provider.addTextTurn(metadata.agentId, "first", "second")

    const first = await provider.generateText({ prompt: "", config, metadata })
    const second = await provider.generateText({ prompt: "", config, metadata })
    const third = await provider.generateText({ prompt: "", config, metadata })

    expect(first).toBe("first")
    expect(second).toBe("second")
    expect(third).toBe("Hello, I'm the text default mock value!")
  })

  it("addTextTurn - should works with agentId", async () => {
    provider.addTextTurn("agent-a", "from A")
    provider.addTextTurn("agent-b", "from B")

    const fromB = await provider.generateText({
      prompt: "",
      config,
      metadata: { ...metadata, agentId: "agent-b" },
    })
    const fromA = await provider.generateText({
      prompt: "",
      config,
      metadata: { ...metadata, agentId: "agent-a" },
    })

    expect(fromB).toBe("from B")
    expect(fromA).toBe("from A")
  })

  it("addStreamTurn - should works", async () => {
    provider.addStreamTurn(metadata.agentId, ["He", "l", "lo!"])
    const results = await streamToStringArray(
      provider.streamChatResponse({ messages, config, metadata }),
    )
    // The AI SDK may coalesce consecutive text deltas, so assert on the content.
    expect(results.length).toBeGreaterThan(0)
    expect(results.join("")).toBe("Hello!")
  })

  it("streamChatResponse - retries once before producing anything, then rethrows if it keeps failing", async () => {
    // A single doStream() failure before any content is produced (e.g. the Gemma idle-timeout,
    // see ai-sdk-llm-provider-base.ts's doStreamWithRetry) is retried once silently. Only once
    // that retry ALSO fails does the error surface to the caller instead of ending silently.
    provider.addErrorTurn(metadata.agentId, new Error("Unsupported chat content part type: 'file'"))
    provider.addErrorTurn(metadata.agentId, new Error("Unsupported chat content part type: 'file'"))

    await expect(
      streamToStringArray(provider.streamChatResponse({ messages, config, metadata })),
    ).rejects.toThrow("Unsupported chat content part type: 'file'")
  })

  it("streamChatResponse - transparently retries a single doStream() failure", async () => {
    provider.addErrorTurn(metadata.agentId, new Error("stalled before producing anything"))
    provider.addTextTurn(metadata.agentId, "recovered on retry")

    const results = await streamToStringArray(
      provider.streamChatResponse({ messages, config, metadata }),
    )

    expect(results.join("")).toBe("recovered on retry")
  })

  it("addObjectTurn - should works", async () => {
    const schema = z.object({ content: z.string(), source: z.string() })
    provider.addObjectTurn(metadata.agentId, { content: "hello", source: "queued" })
    const result = await provider.generateObject({ schema, prompt: "", config, metadata })
    expect(schema.parse(result)).toEqual({ content: "hello", source: "queued" })
  })

  it("addToolCallTurn - should works", async () => {
    const executed: unknown[] = []
    const toolConfig: LLMConfig = {
      model: AgentModel._Mock,
      temperature: 1,
      systemPrompt: "",
      tools: {
        echo: tool({
          description: "echoes its input",
          inputSchema: z.object({ text: z.string() }),
          execute: async (input) => {
            executed.push(input)
            return { echoed: input.text }
          },
        }),
      },
    }
    provider.addToolCallTurn(metadata.agentId, "echo", { text: "hi" })
    provider.addTextTurn(metadata.agentId, "final answer")

    const results = await streamToStringArray(
      provider.streamChatResponse({ messages, config: toolConfig, metadata }),
    )

    expect(executed).toEqual([{ text: "hi" }])
    expect(results.join("")).toBe("final answer")
  })

  it("streamChatResponse - drops a text block that exactly repeats an earlier one in the same turn", async () => {
    // Mirrors observed Gemma behavior: after a tool result is fed back mid-turn, it sometimes
    // re-states its full answer instead of staying silent and just making the next call.
    const executed: unknown[] = []
    const toolConfig: LLMConfig = {
      model: AgentModel._Mock,
      temperature: 1,
      systemPrompt: "",
      tools: {
        echo: tool({
          description: "echoes its input",
          inputSchema: z.object({ text: z.string() }),
          execute: async (input) => {
            executed.push(input)
            return { echoed: input.text }
          },
        }),
      },
    }
    // Step 1: text + a tool call. Step 2: the SAME text repeated + another tool call.
    // Step 3: genuinely new text, no tool call - ends the turn.
    provider.addTextWithToolCallTurn(metadata.agentId, "Here is my report.", "echo", { text: "a" })
    provider.addTextWithToolCallTurn(metadata.agentId, "Here is my report.", "echo", { text: "b" })
    provider.addTextTurn(metadata.agentId, "Done.")

    const results = await streamToStringArray(
      provider.streamChatResponse({ messages, config: toolConfig, metadata }),
    )

    // Both tool calls still executed - the dedupe only touches text, never tool calls.
    expect(executed).toEqual([{ text: "a" }, { text: "b" }])
    // The repeated block only shows up once; genuinely new text still comes through.
    expect(results.join("")).toBe("Here is my report.Done.")
  })

  async function streamToStringArray(
    stream: AsyncGenerator<string, void, unknown>,
  ): Promise<string[]> {
    const values: string[] = []
    for await (const chunk of stream) {
      values.push(chunk)
    }
    return values
  }
})

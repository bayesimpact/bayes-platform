import { AgentModel } from "@caseai-connect/api-contracts"
import { beforeAll, beforeEach } from "@jest/globals"
import { tool } from "ai"
import { v4 } from "uuid"
import { z } from "zod"
import type {
  AdditionalMetadata,
  LLMCallContext,
  LLMChatMessage,
  LLMConfig,
  LLMFile,
} from "@/common/interfaces/llm-provider.interface"
import { MAX_STREAM_OUTPUT_TOKENS } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"

const additionalMetadata: AdditionalMetadata = { environment: "**TEST**" }

describe("AISDKMockProvider", () => {
  let provider: AISDKMockProvider
  let messages: LLMChatMessage[]
  let config: LLMConfig
  let callContext: LLMCallContext
  beforeAll(async () => {
    provider = new AISDKMockProvider()
    messages = [{ role: "user", content: "for test purpose" }]
    config = {
      model: AgentModel._Mock,
      modelOptions: { temperature: 1 },
      systemPrompt: "",
      serviceTier: undefined,
    }
    callContext = {
      agentId: "agentId",
      agentSessionId: "agentSessionId",
      currentTurn: 0,
      organizationId: "organizationId",
      projectId: "projectId",
      traceId: "traceId",
      revision: 1,
    }
  })
  beforeEach(() => {
    provider.resetMock()
    callContext.traceId = v4()
  })

  it("streamChatResponse - default mock value", async () => {
    const stream = provider.streamChatResponse({
      additionalMetadata,
      messages,
      config,
      callContext,
    })
    const results = await streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    expect(results.join("")).toBe("Hello, I'm the stream default mock value!")
  })

  it("generateText - default mock value", async () => {
    const result = await provider.generateText({
      additionalMetadata,
      prompt: "",
      config,
      callContext,
    })
    expect(result).toBe("Hello, I'm the text default mock value!")
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
      additionalMetadata,
      message,
      schema: schema.toJSONSchema(),
      config,
      callContext,
    })
    expect(() => schema.parse(result)).not.toThrow()
    const parsed = schema.parse(result)
    expect(parsed.source).toBe("source-value")
    expect(parsed.content).toBe("content-value")
  })

  it("addTextTurn - returns the specified value", async () => {
    provider.addTextTurn(callContext.agentId, "76")
    const result = await provider.generateText({
      additionalMetadata,
      prompt: "",
      config,
      callContext,
    })
    expect(result).toBe("76")
  })

  it("addTextTurn - returns the specified values in order", async () => {
    provider.addTextTurn(callContext.agentId, "first", "second")

    const first = await provider.generateText({
      additionalMetadata,
      prompt: "",
      config,
      callContext,
    })
    const second = await provider.generateText({
      additionalMetadata,
      prompt: "",
      config,
      callContext,
    })
    const third = await provider.generateText({
      additionalMetadata,
      prompt: "",
      config,
      callContext,
    })

    expect(first).toBe("first")
    expect(second).toBe("second")
    expect(third).toBe("Hello, I'm the text default mock value!")
  })

  it("addTextTurn - should works with agentId", async () => {
    provider.addTextTurn("agent-a", "from A")
    provider.addTextTurn("agent-b", "from B")

    const fromB = await provider.generateText({
      additionalMetadata,
      prompt: "",
      config,
      callContext: { ...callContext, agentId: "agent-b" },
    })
    const fromA = await provider.generateText({
      additionalMetadata,
      prompt: "",
      config,
      callContext: { ...callContext, agentId: "agent-a" },
    })

    expect(fromB).toBe("from B")
    expect(fromA).toBe("from A")
  })

  it("addStreamTurn - should works", async () => {
    provider.addStreamTurn(callContext.agentId, ["He", "l", "lo!"])
    const results = await streamToStringArray(
      provider.streamChatResponse({ additionalMetadata, messages, config, callContext }),
    )
    // The AI SDK may coalesce consecutive text deltas, so assert on the content.
    expect(results.length).toBeGreaterThan(0)
    expect(results.join("")).toBe("Hello!")
  })

  it("streamChatResponse - limits the output tokens of each step", async () => {
    provider.addStreamTurn(callContext.agentId, ["Hello!"])
    await streamToStringArray(
      provider.streamChatResponse({ additionalMetadata, messages, config, callContext }),
    )

    expect(provider.getCalls().at(-1)?.maxOutputTokens).toBe(MAX_STREAM_OUTPUT_TOKENS)
  })

  it("streamChatResponse - rethrows a provider error instead of ending silently", async () => {
    provider.addErrorTurn(
      callContext.agentId,
      new Error("Unsupported chat content part type: 'file'"),
    )

    await expect(
      streamToStringArray(
        provider.streamChatResponse({ additionalMetadata, messages, config, callContext }),
      ),
    ).rejects.toThrow("Unsupported chat content part type: 'file'")
  })

  it("addToolCallTurn - should works", async () => {
    const executed: unknown[] = []
    const toolConfig: LLMConfig = {
      model: AgentModel._Mock,
      modelOptions: { temperature: 1 },
      systemPrompt: "",
      serviceTier: undefined,
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
    provider.addToolCallTurn(callContext.agentId, "echo", { text: "hi" })
    provider.addTextTurn(callContext.agentId, "final answer")

    const results = await streamToStringArray(
      provider.streamChatResponse({
        additionalMetadata,
        messages,
        config: toolConfig,
        callContext,
      }),
    )

    expect(executed).toEqual([{ text: "hi" }])
    expect(results.join("")).toBe("final answer")
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

class TestAISDKMockProvider extends AISDKMockProvider {
  structuredOutputMessageFor(message: LLMChatMessage): LLMChatMessage {
    return this.applySpecificToStructuredOutputMessage({ message, config: {} as LLMConfig })
  }
}

describe("AISDKMockProvider.applySpecificToStructuredOutputMessage", () => {
  const provider = new TestAISDKMockProvider()

  it("swaps a message carrying a file for an inline fake PDF", () => {
    const swapped = provider.structuredOutputMessageFor({
      role: "user",
      content: [
        { type: "text", text: "Give it a title." },
        { type: "image", image: new URL("https://storage.example.com/page.png") },
      ],
    })

    expect(swapped.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "file",
          mediaType: "application/pdf",
          filename: "file1.pdf",
        }),
      ]),
    )
  })

  it("keeps a text-only message as is, so tests can assert on the prompt", () => {
    const message: LLMChatMessage = { role: "user", content: "Classify this turn." }
    expect(provider.structuredOutputMessageFor(message)).toBe(message)
  })
})

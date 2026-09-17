import { AgentModel } from "@caseai-connect/api-contracts"
import { Test } from "@nestjs/testing"
import { tool } from "ai"
import { z } from "zod"
import type { LLMConfig, LLMMetadata } from "@/common/interfaces/llm-provider.interface"
import { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"

/**
 * Gemma sometimes breaks the JSON of a long tool call (a quote too many).
 * The OpenAI chat provider then never emits the call: no tool result, no
 * error, an empty reply. The stream middleware emits the call with the raw
 * arguments, the repair regenerates them through structured output, and the
 * tool runs. When the repair fails, the model gets a tool error and answers.
 */
const MALFORMED_INPUT = '{"answer": "Non applicable"Non applicable", "note": "aucune"}'

describe("malformed tool call repair", () => {
  let provider: AISDKMockProvider

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AISDKMockProvider],
    }).compile()
    provider = moduleRef.get(AISDKMockProvider)
    provider.resetMock()
  })

  const metadata: LLMMetadata = {
    traceId: "trace-1",
    agentSessionId: "session-1",
    currentTurn: 1,
    organizationId: "org-1",
    agentId: "agent-1",
    revision: 1,
    projectId: "project-1",
    tags: [],
  }

  const buildConfig = ({ execute }: { execute: (input: unknown) => Promise<unknown> }): LLMConfig =>
    ({
      model: AgentModel._Mock,
      temperature: 0,
      serviceTier: undefined,
      tools: {
        record_answer: tool({
          description: "Record the user's answer.",
          inputSchema: z.object({ answer: z.string(), note: z.string() }),
          execute: async (input) => execute(input),
        }),
      },
    }) as LLMConfig

  const streamAll = async (config: LLMConfig) => {
    let text = ""
    for await (const chunk of provider.streamChatResponse({
      messages: [{ role: "user", content: "Non applicable." }],
      config,
      metadata,
    })) {
      text += chunk
    }
    return text
  }

  it("repairs the broken arguments through structured output and runs the tool", async () => {
    const execute = jest.fn().mockResolvedValue({ ok: true })
    // Generation 1: the broken call. Generation 2: the structured-output
    // repair. Generation 3: the answer after the tool result.
    provider.addMalformedToolCallTurn("agent-1", "record_answer", MALFORMED_INPUT)
    provider.addObjectTurn("agent-1", { answer: "Non applicable", note: "aucune" })
    provider.addTextTurn("agent-1", "Noted, thank you.")

    const text = await streamAll(buildConfig({ execute }))

    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith({ answer: "Non applicable", note: "aucune" })
    expect(text).toBe("Noted, thank you.")
  })

  it("tells the model when the repair fails, so it can call again", async () => {
    const execute = jest.fn().mockResolvedValue({ ok: true })
    provider.addMalformedToolCallTurn("agent-1", "record_answer", MALFORMED_INPUT)
    // The repair answers with something the schema rejects.
    provider.addObjectTurn("agent-1", { wrong: true })
    provider.addToolCallTurn("agent-1", "record_answer", { answer: "Non applicable", note: "" })
    provider.addTextTurn("agent-1", "Noted.")

    const text = await streamAll(buildConfig({ execute }))

    const calls = provider.getCalls().filter((call) => call.agentId === "agent-1")
    // The generation after the failed repair carries the tool error, not an empty turn.
    expect(calls.at(2)?.prompt).toContain("record_answer")
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith({ answer: "Non applicable", note: "" })
    expect(text).toBe("Noted.")
  })
})

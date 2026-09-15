import { AgentModel } from "@caseai-connect/api-contracts"
import { Test } from "@nestjs/testing"
import { tool } from "ai"
import { z } from "zod"
import type { LLMConfig, LLMMetadata } from "@/common/interfaces/llm-provider.interface"
import { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"

/**
 * Gemini models (lite especially) sometimes verbalize a tool call as
 * pseudo-XML in the TEXT channel instead of emitting a functionCall part.
 * The tool then never runs, and the sanitizer hides the tag from the user —
 * so a tool with side effects fails silently. Recovery converts the leaked
 * tag into validated arguments through structured output, then executes.
 */
const LEAKED_CALL_TEXT =
  "Voici votre réponse, votre demande est bien prise en compte.\n\n" +
  "<call:default_api:notify_operator{severity:high," +
  "summary:Escalation requested by the user.,reference:ABC-123}/>"

describe("leaked tool call recovery", () => {
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
        notify_operator: tool({
          description: "Notify a human operator about this conversation.",
          inputSchema: z.object({
            severity: z.enum(["low", "medium", "high"]),
            summary: z.string(),
            reference: z.string(),
          }),
          execute: async (input) => execute(input),
        }),
      },
    }) as LLMConfig

  const streamAll = async (config: LLMConfig) => {
    let text = ""
    for await (const chunk of provider.streamChatResponse({
      messages: [{ role: "user", content: "Je veux parler à quelqu'un." }],
      config,
      metadata,
    })) {
      text += chunk
    }
    return text
  }

  it("executes the tool the model verbalized in the text, with the leaked arguments", async () => {
    const execute = jest.fn().mockResolvedValue({ ok: true })
    // Generation 1: the answer carrying the leaked call. Generation 2: the
    // structured-output recovery, which the mock answers with valid input.
    provider.addTextTurn("agent-1", LEAKED_CALL_TEXT)
    provider.addObjectTurn("agent-1", {
      severity: "high",
      summary: "Escalation requested by the user.",
      reference: "ABC-123",
    })

    const text = await streamAll(buildConfig({ execute }))

    // The user never sees the leaked tag.
    expect(text).not.toContain("default_api")
    expect(text).toContain("bien prise en compte")
    // …and the tool actually ran, with the arguments the model intended.
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith({
      severity: "high",
      summary: "Escalation requested by the user.",
      reference: "ABC-123",
    })
  })

  it("recovers the brace-terminated <function:> variant that has no closing angle bracket", async () => {
    const execute = jest.fn().mockResolvedValue({ ok: true })
    provider.addTextTurn(
      "agent-1",
      "Voici votre réponse, votre demande est bien prise en compte.\n\n" +
        "<function:default_api:notify_operator{severity:high," +
        "summary:Escalation requested by the user.,reference:ABC-123}",
    )
    provider.addObjectTurn("agent-1", {
      severity: "high",
      summary: "Escalation requested by the user.",
      reference: "ABC-123",
    })

    const text = await streamAll(buildConfig({ execute }))

    expect(text).not.toContain("default_api")
    expect(text).not.toContain("<function")
    expect(text).toContain("bien prise en compte")
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith({
      severity: "high",
      summary: "Escalation requested by the user.",
      reference: "ABC-123",
    })
  })

  it("recovers the name-only variant, matched through the declared tool names", async () => {
    const execute = jest.fn().mockResolvedValue({ ok: true })
    provider.addTextTurn(
      "agent-1",
      "Voici votre réponse, votre demande est bien prise en compte.\n\n" +
        "notify_operator{severity:high," +
        "summary:Escalation requested by the user.,reference:ABC-123}",
    )
    provider.addObjectTurn("agent-1", {
      severity: "high",
      summary: "Escalation requested by the user.",
      reference: "ABC-123",
    })

    const text = await streamAll(buildConfig({ execute }))

    expect(text).not.toContain("notify_operator")
    expect(text).not.toContain("severity")
    expect(text).toContain("bien prise en compte")
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith({
      severity: "high",
      summary: "Escalation requested by the user.",
      reference: "ABC-123",
    })
  })

  it("does not run recovery when no call leaked", async () => {
    const execute = jest.fn()
    provider.addTextTurn("agent-1", "Voici votre réponse, sans balise.")

    await streamAll(buildConfig({ execute }))

    expect(execute).not.toHaveBeenCalled()
  })
})

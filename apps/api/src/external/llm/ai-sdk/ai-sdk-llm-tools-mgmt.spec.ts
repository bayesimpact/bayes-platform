import type {
  LanguageModelV3,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
} from "@ai-sdk/provider"
import { AgentModel, AgentThinkingLevel } from "@caseai-connect/api-contracts"
import type { Logger } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import {
  InvalidToolInputError,
  NoSuchToolError,
  type StepResult,
  type StopCondition,
  type ToolCallRepairFunction,
  type ToolSet,
  tool,
} from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { z } from "zod"
import type { LLMConfig, LLMMetadata } from "@/common/interfaces/llm-provider.interface"
import type { SpecificProviderOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-builders"
import {
  AISDKLLMToolsMgmt,
  type LeakedToolCall,
  type UnfinishedToolCallTracker,
} from "@/external/llm/ai-sdk/ai-sdk-llm-tools-mgmt"
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"

type CallArgs = {
  model: LanguageModelV3
  config: LLMConfig
  metadata: LLMMetadata
  functionId: string
  tags: string[]
}

type ExecutedSteps = Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>

// A leak captured from gemini-3.5-flash-lite: the model verbalizes its tool
// call as pseudo-XML in the user-visible text instead of emitting a
// functionCall part.
const LEAKED_PSEUDO_CALL =
  '<call:default_api:mandatory_tool xmlns:default_api="default_api" categoryNames:[greetings,QA],suggestedTitle:Règles de Warmachine et pays de pays/>'

// A newer leak variant captured in production: opens with `<function:` and
// terminates at the closing brace of its arguments — there is no `>` at all.
const LEAKED_FUNCTION_CALL =
  "<function:default_api:mandatory_tool{categoryNames:[test],suggestedTitle:null}"

// Captured in production: no `<` at all, the namespace is glued to a garbled
// word and only the argument braces delimit the call.
const LEAKED_BARE_CALL = "Lie:default_api:mandatory_tool{categoryNames:[],suggestedTitle:null}"

// Captured in production on Gemma: the bare tool name glued to its
// arguments, with no `<`, no `call:` and no `default_api:` at all.
const LEAKED_NAME_ONLY_CALL =
  "mandatory_tool{categoryNames:[greetings,QA],suggestedTitle:Horaires d'ouverture le week-end}"

const buildLoggerMock = () => ({ warn: jest.fn(), error: jest.fn() })

class TestToolsMgmt extends AISDKLLMToolsMgmt {
  readonly leakedLogger = buildLoggerMock()
  readonly malformedLogger = buildLoggerMock()
  protected readonly leakedToolCallLogger = this.leakedLogger as unknown as Logger
  protected readonly malformedToolCallLogger = this.malformedLogger as unknown as Logger

  protected buildSpecificProviderOptions({
    config,
  }: {
    config: LLMConfig
  }): SpecificProviderOptions {
    return { temperature: config.temperature }
  }

  toolCallRepairFor(args: CallArgs): ToolCallRepairFunction<ToolSet> {
    return this.buildToolCallRepair(args)
  }
  recoverLeakedToolCallsFor(
    args: CallArgs & { leakedToolCalls: LeakedToolCall[]; steps: Promise<ExecutedSteps> },
  ): Promise<void> {
    const { steps, ...rest } = args
    return this.recoverLeakedToolCalls({ ...rest, streamResult: { steps } })
  }
  leakedToolCallNamesFor(text: string): string[] {
    return this.findLeakedToolCalls(text).map((leakedCall) => leakedCall.name)
  }
  logLeakedToolCallsFor(args: {
    originalText: string
    config?: LLMConfig
    leakedToolCalls?: LeakedToolCall[]
  }): void {
    this.logLeakedToolCalls(args)
  }
  stopConditionsFor(config: LLMConfig): StopCondition<ToolSet>[] | undefined {
    return this.buildStopConditions(config)
  }
  fireAndForgetStopConditionFor(fireAndForgetToolNames: string[]): StopCondition<ToolSet> {
    return this.fireAndForgetStopCondition({ fireAndForgetToolNames })
  }
  unfinishedToolCallTrackerFor(): UnfinishedToolCallTracker {
    return this.createUnfinishedToolCallTracker()
  }
  terminalStopConditionFor(terminalToolNames: string[]): StopCondition<ToolSet> {
    return this.terminalToolsStopCondition({ terminalToolNames })
  }
  strictToolsFor(tools: ToolSet | undefined): ToolSet | undefined {
    return this.withStrictTools(tools)
  }
  strictToolsSupported(): boolean {
    return this.supportsStrictTools()
  }
}

/** A provider that sends no temperature and options of its own (as Vertex 3.x does). */
class TestToolsMgmtWithSpecificOptions extends TestToolsMgmt {
  protected buildSpecificProviderOptions() {
    return { providerOptions: { vertex: { thinkingBudget: 0 } } }
  }
}

/** A model whose structured output is `text`, or which throws `error`. */
function buildModel({ text, error }: { text?: string; error?: Error }): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async (): Promise<LanguageModelV3GenerateResult> => {
      if (error) throw error
      return {
        content: [{ type: "text", text: text ?? "" }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 0, text: 0, reasoning: undefined },
        },
        warnings: [],
      }
    },
  })
}

function promptOf(model: MockLanguageModelV3): string {
  return JSON.stringify(model.doGenerateCalls[0]?.prompt)
}

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

/** The SDK stops the loop as soon as one condition holds. */
async function shouldStop(
  stopConditions: StopCondition<ToolSet>[],
  steps: StepResult<ToolSet>[],
): Promise<boolean> {
  const results = await Promise.all(stopConditions.map((stopCondition) => stopCondition({ steps })))
  return results.some(Boolean)
}

const metadata: LLMMetadata = {
  traceId: "trace-id",
  agentSessionId: "agent-session-id",
  currentTurn: 1,
  organizationId: "organization-id",
  projectId: "project-id",
  agentId: "agent-id",
  revision: 1,
  tags: [],
}

const baseConfig: LLMConfig = {
  model: AgentModel._Mock,
  temperature: 0,
  systemPrompt: "",
  serviceTier: undefined,
  thinkingLevel: AgentThinkingLevel.Auto,
}

function buildCallArgs(model: LanguageModelV3, config: LLMConfig = baseConfig): CallArgs {
  return {
    model,
    config,
    metadata,
    functionId: "function-id",
    tags: [],
  }
}

describe("AISDKLLMToolsMgmt", () => {
  let toolsMgmt: TestToolsMgmt

  beforeEach(() => {
    toolsMgmt = new TestToolsMgmt()
  })

  describe("buildToolCallRepair", () => {
    const MALFORMED_INPUT = '{"title": "Pricing"Pricing", "summary": "none"}'
    const tools = {
      record_summary: tool({
        description: "Records a summary.",
        inputSchema: z.object({ title: z.string(), summary: z.string() }),
      }),
    }
    const toolCall = {
      type: "tool-call" as const,
      toolCallId: "call-1",
      toolName: "record_summary",
      input: MALFORMED_INPUT,
    }
    const invalidInputError = new InvalidToolInputError({
      toolName: "record_summary",
      toolInput: MALFORMED_INPUT,
      cause: new Error("Unexpected token"),
    })

    const repair = (
      model: LanguageModelV3,
      overrides: { toolCall?: typeof toolCall; error?: Error } = {},
    ) =>
      toolsMgmt.toolCallRepairFor(buildCallArgs(model))({
        system: undefined,
        messages: [],
        toolCall: overrides.toolCall ?? toolCall,
        tools,
        inputSchema: async () => ({}),
        error: overrides.error ?? invalidInputError,
      } as unknown as Parameters<ToolCallRepairFunction<ToolSet>>[0])

    it("regenerates the broken arguments through structured output", async () => {
      const model = buildModel({ text: '{"title":"Pricing","summary":"none"}' })

      const repaired = await repair(model)

      expect(repaired).toEqual({
        ...toolCall,
        input: JSON.stringify({ title: "Pricing", summary: "none" }),
      })
      expect(promptOf(model)).toContain("Pricing")
      expect(toolsMgmt.malformedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('"record_summary"'),
      )
    })

    it("regenerates with the provider's specific call settings", async () => {
      const model = buildModel({ text: '{"title":"Pricing","summary":"none"}' })
      const defaultModel = buildModel({ text: '{"title":"Pricing","summary":"none"}' })

      await new TestToolsMgmtWithSpecificOptions().toolCallRepairFor(buildCallArgs(model))({
        system: undefined,
        messages: [],
        toolCall,
        tools,
        inputSchema: async () => ({}),
        error: invalidInputError,
      } as unknown as Parameters<ToolCallRepairFunction<ToolSet>>[0])
      await repair(defaultModel)

      expect(model.doGenerateCalls[0]?.temperature).toBeUndefined()
      expect(model.doGenerateCalls[0]?.providerOptions).toEqual({ vertex: { thinkingBudget: 0 } })
      expect(defaultModel.doGenerateCalls[0]?.temperature).toBe(0)
    })

    it("does not repair an error other than invalid arguments", async () => {
      const model = buildModel({ text: "{}" })

      const repaired = await repair(model, {
        error: new NoSuchToolError({ toolName: "record_summary" }),
      })

      expect(repaired).toBeNull()
      expect(model.doGenerateCalls).toHaveLength(0)
    })

    it("does not repair a call to an undeclared tool", async () => {
      const model = buildModel({ text: "{}" })

      const repaired = await repair(model, { toolCall: { ...toolCall, toolName: "unknown_tool" } })

      expect(repaired).toBeNull()
      expect(model.doGenerateCalls).toHaveLength(0)
    })

    it("gives up and logs when the regeneration fails", async () => {
      const model = buildModel({ error: new Error("model unavailable") })

      const repaired = await repair(model)

      expect(repaired).toBeNull()
      expect(toolsMgmt.malformedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("model unavailable"),
      )
    })

    describe("through the mock provider", () => {
      /**
       * Gemma sometimes breaks the JSON of a long tool call (a quote too many).
       * The OpenAI chat provider then never emits the call: no tool result, no
       * error, an empty reply. The stream middleware emits the call with the raw
       * arguments, the repair regenerates them through structured output, and the
       * tool runs. When the repair fails, the model gets a tool error and answers.
       */
      const BROKEN_INPUT = '{"answer": "Non applicable"Non applicable", "note": "aucune"}'

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

      const buildConfig = ({
        execute,
      }: {
        execute: (input: unknown) => Promise<unknown>
      }): LLMConfig =>
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
          thinkingLevel: AgentThinkingLevel.Auto,
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
        provider.addMalformedToolCallTurn("agent-1", "record_answer", BROKEN_INPUT)
        provider.addObjectTurn("agent-1", { answer: "Non applicable", note: "aucune" })
        provider.addTextTurn("agent-1", "Noted, thank you.")

        const text = await streamAll(buildConfig({ execute }))

        expect(execute).toHaveBeenCalledTimes(1)
        expect(execute).toHaveBeenCalledWith({ answer: "Non applicable", note: "aucune" })
        expect(text).toBe("Noted, thank you.")
      })

      it("tells the model when the repair fails, so it can call again", async () => {
        const execute = jest.fn().mockResolvedValue({ ok: true })
        provider.addMalformedToolCallTurn("agent-1", "record_answer", BROKEN_INPUT)
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
  })

  describe("recoverLeakedToolCalls", () => {
    const LEAKED_CALL: LeakedToolCall = {
      name: "notify_operator",
      raw: "<call:default_api:notify_operator{severity:high,summary:Escalation requested.,reference:ABC-123}/>",
    }

    const buildConfig = (execute: jest.Mock): LLMConfig => ({
      ...baseConfig,
      tools: {
        notify_operator: tool({
          description: "Notifies a human operator.",
          inputSchema: z.object({
            severity: z.enum(["low", "medium", "high"]),
            summary: z.string(),
            reference: z.string(),
          }),
          execute,
        }),
        hand_back: tool({
          description: "Hands the conversation back.",
          inputSchema: z.object({}),
          execute,
        }),
      },
    })

    const recover = ({
      model,
      config,
      leakedToolCalls,
      steps = Promise.resolve([]),
    }: {
      model: LanguageModelV3
      config: LLMConfig
      leakedToolCalls: LeakedToolCall[]
      steps?: Promise<ExecutedSteps>
    }) =>
      toolsMgmt.recoverLeakedToolCallsFor({
        ...buildCallArgs(model, config),
        leakedToolCalls,
        steps,
      })

    it("executes the leaked call with the arguments regenerated through structured output", async () => {
      const execute = jest.fn()
      const model = buildModel({
        text: '{"severity":"high","summary":"Escalation requested.","reference":"ABC-123"}',
      })

      await recover({ model, config: buildConfig(execute), leakedToolCalls: [LEAKED_CALL] })

      expect(execute).toHaveBeenCalledWith(
        { severity: "high", summary: "Escalation requested.", reference: "ABC-123" },
        expect.objectContaining({ toolCallId: "recovered-notify_operator" }),
      )
      expect(promptOf(model)).toContain("ABC-123")
      expect(toolsMgmt.leakedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('"notify_operator"'),
      )
    })

    it("regenerates the arguments with the provider's specific call settings", async () => {
      const model = buildModel({
        text: '{"severity":"high","summary":"Escalation requested.","reference":"ABC-123"}',
      })

      await new TestToolsMgmtWithSpecificOptions().recoverLeakedToolCallsFor({
        ...buildCallArgs(model, buildConfig(jest.fn())),
        leakedToolCalls: [LEAKED_CALL],
        steps: Promise.resolve([]),
      })

      expect(model.doGenerateCalls[0]?.temperature).toBeUndefined()
      expect(model.doGenerateCalls[0]?.providerOptions).toEqual({ vertex: { thinkingBudget: 0 } })
    })

    it("executes a tool without arguments without regenerating anything", async () => {
      const execute = jest.fn()
      const model = buildModel({ text: "{}" })

      await recover({
        model,
        config: buildConfig(execute),
        leakedToolCalls: [{ name: "hand_back", raw: "<call:hand_back/>" }],
      })

      expect(execute).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ toolCallId: "recovered-hand_back" }),
      )
      expect(model.doGenerateCalls).toHaveLength(0)
    })

    it("does nothing when no call leaked", async () => {
      const execute = jest.fn()
      const model = buildModel({ text: "{}" })

      await recover({ model, config: buildConfig(execute), leakedToolCalls: [] })

      expect(execute).not.toHaveBeenCalled()
      expect(model.doGenerateCalls).toHaveLength(0)
    })

    it("does nothing when the call declares no tools", async () => {
      const model = buildModel({ text: "{}" })

      await recover({ model, config: baseConfig, leakedToolCalls: [LEAKED_CALL] })

      expect(model.doGenerateCalls).toHaveLength(0)
      expect(toolsMgmt.leakedLogger.error).not.toHaveBeenCalled()
    })

    it("skips a tool that already ran in the turn", async () => {
      const execute = jest.fn()
      const model = buildModel({ text: "{}" })

      await recover({
        model,
        config: buildConfig(execute),
        leakedToolCalls: [LEAKED_CALL],
        steps: Promise.resolve([{ toolResults: [{ toolName: "notify_operator", output: "ok" }] }]),
      })

      expect(execute).not.toHaveBeenCalled()
      expect(model.doGenerateCalls).toHaveLength(0)
    })

    it("logs a leaked call to an undeclared tool and moves on to the next one", async () => {
      const execute = jest.fn()
      const model = buildModel({ text: "{}" })

      await recover({
        model,
        config: buildConfig(execute),
        leakedToolCalls: [
          { name: "unknown_tool", raw: "<call:unknown_tool/>" },
          { name: "hand_back", raw: "<call:hand_back/>" },
        ],
      })

      expect(toolsMgmt.leakedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('"unknown_tool"'),
      )
      expect(execute).toHaveBeenCalledTimes(1)
    })

    it("does not execute the tool when the regenerated arguments do not fit its schema", async () => {
      const execute = jest.fn()
      const model = buildModel({
        text: '{"severity":"urgent","summary":"Escalation requested.","reference":"ABC-123"}',
      })

      await recover({ model, config: buildConfig(execute), leakedToolCalls: [LEAKED_CALL] })

      expect(execute).not.toHaveBeenCalled()
      expect(toolsMgmt.leakedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('could not recover the leaked call to "notify_operator"'),
      )
    })

    it("keeps recovering the next calls when one fails", async () => {
      const execute = jest.fn()
      const model = buildModel({ error: new Error("model unavailable") })

      await recover({
        model,
        config: buildConfig(execute),
        leakedToolCalls: [LEAKED_CALL, { name: "hand_back", raw: "<call:hand_back/>" }],
      })

      expect(toolsMgmt.leakedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('"notify_operator": model unavailable'),
      )
      expect(execute).toHaveBeenCalledTimes(1)
      expect(execute).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ toolCallId: "recovered-hand_back" }),
      )
    })

    it("logs instead of throwing when the turn steps cannot be read", async () => {
      const execute = jest.fn()
      const model = buildModel({ text: "{}" })

      await expect(
        recover({
          model,
          config: buildConfig(execute),
          leakedToolCalls: [LEAKED_CALL],
          steps: Promise.reject(new Error("stream aborted")),
        }),
      ).resolves.toBeUndefined()

      expect(execute).not.toHaveBeenCalled()
      expect(toolsMgmt.leakedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("stream aborted"),
      )
    })

    describe("through the mock provider", () => {
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

      const buildConfig = ({
        execute,
      }: {
        execute: (input: unknown) => Promise<unknown>
      }): LLMConfig =>
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
          thinkingLevel: AgentThinkingLevel.Auto,
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

      it("recovers the name-only variant", async () => {
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
  })

  describe("findLeakedToolCalls", () => {
    it("extracts the tool name from the bracketed variant", () => {
      expect(toolsMgmt.leakedToolCallNamesFor("Tout est noté. [concludeHandoff]")).toEqual([
        "concludeHandoff",
      ])
    })

    it("extracts the tool name from the brace-argument variant", () => {
      const text =
        "Voici votre réponse.\n\n<call:default_api:notify_operator{severity:high," +
        "summary:Escalation requested by the user.,reference:ABC-123}/>"

      expect(toolsMgmt.leakedToolCallNamesFor(text)).toEqual(["notify_operator"])
    })

    it("extracts the tool name from the attribute-style variant", () => {
      expect(toolsMgmt.leakedToolCallNamesFor(LEAKED_PSEUDO_CALL)).toEqual(["mandatory_tool"])
    })

    it("extracts the tool name from the <function:> brace variant with no closing angle bracket", () => {
      const text = `Je vous invite à contacter votre conseiller.\n\n${LEAKED_FUNCTION_CALL}`
      expect(toolsMgmt.leakedToolCallNamesFor(text)).toEqual(["mandatory_tool"])
    })

    it("extracts the tool name from the bare variant with no angle bracket", () => {
      expect(toolsMgmt.leakedToolCallNamesFor(`Bonjour ! ${LEAKED_BARE_CALL}`)).toEqual([
        "mandatory_tool",
      ])
    })

    it("extracts the tool name from the name-only variant", () => {
      expect(toolsMgmt.leakedToolCallNamesFor(`Bonjour ! ${LEAKED_NAME_ONLY_CALL}`)).toEqual([
        "mandatory_tool",
      ])
    })

    it("returns nothing for legitimate text, including angle brackets and markup", () => {
      expect(
        toolsMgmt.leakedToolCallNamesFor("2 < 3 and <b>bold</b> and a call: to action"),
      ).toEqual([])
      expect(toolsMgmt.leakedToolCallNamesFor("Voici ma réponse, sans balise.")).toEqual([])
    })

    it("deduplicates repeated leaks of the same tool", () => {
      const text = `${LEAKED_PSEUDO_CALL} then again ${LEAKED_PSEUDO_CALL}`
      expect(toolsMgmt.leakedToolCallNamesFor(text)).toEqual(["mandatory_tool"])
    })
  })

  describe("logLeakedToolCalls", () => {
    const LEAKED_TEXT =
      "Your request is noted.\n\n<call:default_api:notify_operator{severity:high,summary:Escalation requested.}/>"
    const config: LLMConfig = {
      ...baseConfig,
      tools: { notify_operator: tool({ inputSchema: z.object({ severity: z.string() }) }) },
    }

    it("collects the leaked calls and logs them with the declared tools and the model", () => {
      const leakedToolCalls: LeakedToolCall[] = []

      toolsMgmt.logLeakedToolCallsFor({ originalText: LEAKED_TEXT, config, leakedToolCalls })

      expect(leakedToolCalls.map((leakedCall) => leakedCall.name)).toEqual(["notify_operator"])
      expect(toolsMgmt.leakedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `["notify_operator"] (declared: ["notify_operator"], model: ${AgentModel._Mock})`,
        ),
      )
    })

    it("logs even when the caller does not collect the leaked calls", () => {
      toolsMgmt.logLeakedToolCallsFor({ originalText: LEAKED_TEXT })

      expect(toolsMgmt.leakedLogger.error).toHaveBeenCalledTimes(1)
    })

    it("stays silent when no call leaked", () => {
      const leakedToolCalls: LeakedToolCall[] = []

      toolsMgmt.logLeakedToolCallsFor({ originalText: "A plain answer.", config, leakedToolCalls })

      expect(leakedToolCalls).toEqual([])
      expect(toolsMgmt.leakedLogger.error).not.toHaveBeenCalled()
    })
  })

  describe("buildStopConditions", () => {
    it("returns undefined without fire-and-forget nor terminal tools, so the SDK default applies", () => {
      expect(toolsMgmt.stopConditionsFor(baseConfig)).toBeUndefined()
      expect(
        toolsMgmt.stopConditionsFor({
          ...baseConfig,
          fireAndForgetToolNames: [],
          terminalToolNames: [],
        }),
      ).toBeUndefined()
    })

    it("keeps the 20 steps safety net when conditions are added", async () => {
      const stopConditions = toolsMgmt.stopConditionsFor({
        ...baseConfig,
        terminalToolNames: ["take_over_form"],
      })!
      const step = buildStep({ toolNames: ["lookup_knowledge_base"] })

      expect(await shouldStop(stopConditions, Array(19).fill(step))).toBe(false)
      expect(await shouldStop(stopConditions, Array(20).fill(step))).toBe(true)
    })

    it("stops after a fire-and-forget only step when only fire-and-forget tools are declared", async () => {
      const stopConditions = toolsMgmt.stopConditionsFor({
        ...baseConfig,
        fireAndForgetToolNames: ["sources"],
      })!

      expect(stopConditions).toHaveLength(2)
      expect(
        await shouldStop(stopConditions, [buildStep({ text: "Hi", toolNames: ["sources"] })]),
      ).toBe(true)
      expect(
        await shouldStop(stopConditions, [
          buildStep({ text: "Hi", toolNames: ["take_over_form"] }),
        ]),
      ).toBe(false)
    })

    it("stops after a hand-over when only terminal tools are declared", async () => {
      const stopConditions = toolsMgmt.stopConditionsFor({
        ...baseConfig,
        terminalToolNames: ["take_over_form"],
      })!

      expect(stopConditions).toHaveLength(2)
      expect(
        await shouldStop(stopConditions, [
          buildStep({ text: "I hand you over.", toolNames: ["take_over_form"] }),
        ]),
      ).toBe(true)
      expect(
        await shouldStop(stopConditions, [buildStep({ text: "Hi", toolNames: ["sources"] })]),
      ).toBe(false)
    })

    it("combines both conditions when both kinds of tools are declared", async () => {
      const stopConditions = toolsMgmt.stopConditionsFor({
        ...baseConfig,
        fireAndForgetToolNames: ["sources"],
        terminalToolNames: ["take_over_form"],
      })!

      expect(stopConditions).toHaveLength(3)
      expect(
        await shouldStop(stopConditions, [buildStep({ text: "Hi", toolNames: ["sources"] })]),
      ).toBe(true)
      expect(
        await shouldStop(stopConditions, [
          buildStep({ text: "I hand you over.", toolNames: ["take_over_form"] }),
        ]),
      ).toBe(true)
    })
  })

  describe("terminalToolsStopCondition", () => {
    const condition = () => toolsMgmt.terminalStopConditionFor(["take_over_form"])

    it("keeps going while no terminal tool ran", async () => {
      const steps = [buildStep({ toolNames: ["lookup_knowledge_base"] }), buildStep({ text: "Hi" })]
      expect(await condition()({ steps })).toBe(false)
    })

    it("stops on the hand-over step when it already carries the closing sentence", async () => {
      const steps = [buildStep({ text: "I hand you over.", toolNames: ["take_over_form"] })]
      expect(await condition()({ steps })).toBe(true)
    })

    it("allows one more generation for the sentence, then stops", async () => {
      const handOver = buildStep({ toolNames: ["take_over_form"] })
      expect(await condition()({ steps: [handOver] })).toBe(false)
      expect(
        await condition()({ steps: [handOver, buildStep({ text: "I hand you over." })] }),
      ).toBe(true)
    })

    it("stops after the extra generation even when the model called other tools instead of writing", async () => {
      const steps = [
        buildStep({ toolNames: ["take_over_form"] }),
        buildStep({ toolNames: ["take_over_other"] }),
      ]
      expect(await condition()({ steps })).toBe(true)
    })
  })

  describe("fireAndForgetStopCondition", () => {
    const condition = () => toolsMgmt.fireAndForgetStopConditionFor(["sources", "surfaceResources"])

    it("should stop when the step only calls fire-and-forget tools alongside a text answer", async () => {
      const steps = [buildStep({ text: "You get 25 days of paid leave.", toolNames: ["sources"] })]
      expect(await condition()({ steps })).toBe(true)
    })

    it("should stop when several fire-and-forget tools are called in the same step", async () => {
      const steps = [
        buildStep({ text: "Here is what I found.", toolNames: ["sources", "surfaceResources"] }),
      ]
      expect(await condition()({ steps })).toBe(true)
    })

    it("should stop when the text was produced in an earlier step", async () => {
      const steps = [
        buildStep({ text: "Answer given in a previous step." }),
        buildStep({ toolNames: ["sources"] }),
      ]
      expect(await condition()({ steps })).toBe(true)
    })

    it("should not stop when no text was produced yet", async () => {
      const steps = [buildStep({ toolNames: ["sources"] })]
      expect(await condition()({ steps })).toBe(false)
    })

    it("should not stop when the step mixes fire-and-forget and round-trip tools", async () => {
      const steps = [
        buildStep({ text: "Looking it up.", toolNames: ["sources", "lookup_knowledge_base"] }),
      ]
      expect(await condition()({ steps })).toBe(false)
    })

    it("should not stop when the step only calls round-trip tools", async () => {
      const steps = [buildStep({ text: "Looking it up.", toolNames: ["lookup_knowledge_base"] })]
      expect(await condition()({ steps })).toBe(false)
    })

    it("should not stop when the step has no tool calls", async () => {
      const steps = [buildStep({ text: "Plain answer without tools." })]
      expect(await condition()({ steps })).toBe(false)
    })

    it("should not stop when there are no steps", async () => {
      expect(await condition()({ steps: [] })).toBe(false)
    })

    it("should ignore whitespace-only text when deciding whether an answer exists", async () => {
      const steps = [buildStep({ text: "  \n", toolNames: ["sources"] })]
      expect(await condition()({ steps })).toBe(false)
    })
  })

  describe("createUnfinishedToolCallTracker", () => {
    const finish: LanguageModelV3StreamPart = {
      type: "finish",
      finishReason: { unified: "tool-calls", raw: "tool_calls" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
        raw: undefined,
      },
    }

    it("emits the tool call the provider dropped, with its raw arguments", () => {
      const tracker = toolsMgmt.unfinishedToolCallTrackerFor()
      tracker.before({ type: "tool-input-start", id: "call-1", toolName: "fillForm" })
      tracker.before({ type: "tool-input-delta", id: "call-1", delta: '{"a": "x"' })
      tracker.before({ type: "tool-input-delta", id: "call-1", delta: 'x", "b": 1}' })

      expect(tracker.before(finish)).toEqual([
        { type: "tool-input-end", id: "call-1" },
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "fillForm",
          input: '{"a": "x"x", "b": 1}',
        },
      ])
      expect(tracker.emitted()).toEqual(["fillForm"])
    })

    it("adds nothing when the provider emitted the tool call itself", () => {
      const tracker = toolsMgmt.unfinishedToolCallTrackerFor()
      tracker.before({ type: "tool-input-start", id: "call-1", toolName: "fillForm" })
      tracker.before({ type: "tool-input-delta", id: "call-1", delta: "{}" })
      tracker.before({ type: "tool-input-end", id: "call-1" })
      tracker.before({ type: "tool-call", toolCallId: "call-1", toolName: "fillForm", input: "{}" })

      expect(tracker.before(finish)).toEqual([])
      expect(tracker.emitted()).toEqual([])
    })

    it("ignores text and streams without tool input", () => {
      const tracker = toolsMgmt.unfinishedToolCallTrackerFor()
      tracker.before({ type: "text-start", id: "t" })
      tracker.before({ type: "text-delta", id: "t", delta: "Hello" })
      tracker.before({ type: "text-end", id: "t" })

      expect(tracker.before(finish)).toEqual([])
    })
  })

  describe("withStrictTools", () => {
    it("marks every tool strict", () => {
      const tools = toolsMgmt.strictToolsFor({
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

      const wrapped = toolsMgmt.strictToolsFor({ summary: dynamicTool })?.summary
      expect(wrapped?.description).toBe("without chunks")

      lookupRan = true
      expect(wrapped?.description).toBe("with chunks")
      expect(wrapped?.strict).toBe(true)
    })

    it("keeps execute callable and returns undefined for undefined tool sets", async () => {
      const wrapped = toolsMgmt.strictToolsFor({
        alpha: tool({
          description: "a",
          inputSchema: z.object({}),
          execute: async () => "ran",
        }),
      })
      await expect(wrapped?.alpha?.execute?.({}, {} as never)).resolves.toBe("ran")

      expect(toolsMgmt.strictToolsFor(undefined)).toBeUndefined()
    })

    it("does not mutate the original tools", () => {
      const original = tool({ description: "a", inputSchema: z.object({}) })
      toolsMgmt.strictToolsFor({ alpha: original })

      expect(original.strict).toBeUndefined()
    })
  })

  describe("supportsStrictTools", () => {
    it("is off by default", () => {
      expect(toolsMgmt.strictToolsSupported()).toBe(false)
    })
  })
})

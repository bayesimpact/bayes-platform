import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
} from "@ai-sdk/provider"
import { AgentModel, AgentProvider, AgentThinkingLevel } from "@caseai-connect/api-contracts"
import { type Span, trace } from "@opentelemetry/api"
import { simulateReadableStream } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { z } from "zod"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMMetadata,
} from "@/common/interfaces/llm-provider.interface"
import type { SpecificProviderOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-builders"
import {
  CallOrigin,
  RAW_LLM_REQUEST_ATTR,
  RAW_LLM_RESPONSE_ATTR,
  RAW_LLM_RESPONSE_STRIPPED_ATTR,
} from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import {
  AISDKLLMModelMgmt,
  defineModelOptions,
  type ModelOptions,
  type RepeatedStepTextFilter,
  type StreamPartLike,
  type StreamSanitizer,
} from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import type { LeakedToolCall } from "@/external/llm/ai-sdk/ai-sdk-llm-tools-mgmt"

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

const mockConfig: LLMConfig = {
  model: AgentModel._Mock,
  temperature: 0,
  systemPrompt: "",
  serviceTier: undefined,
  thinkingLevel: AgentThinkingLevel.Auto,
}

const mockMetadata: LLMMetadata = {
  traceId: "trace-id",
  agentSessionId: "agent-session-id",
  currentTurn: 1,
  organizationId: "organization-id",
  projectId: "project-id",
  agentId: "agent-id",
  revision: 1,
  tags: [],
}

class TestModelMgmt extends AISDKLLMModelMgmt<AgentProvider._Mock> {
  protected readonly modelOptions: Record<AgentModel._Mock, ModelOptions> = {
    [AgentModel._Mock]: defineModelOptions(z.object({ temperature: z.number() }), {
      temperature: 0,
    }),
  }

  constructor(private readonly model?: LanguageModelV3) {
    super()
  }

  getAgentProvider(): AgentProvider._Mock {
    return AgentProvider._Mock
  }
  getLanguageModel(): LanguageModelV3 {
    if (!this.model) throw new Error("TestModelMgmt was built without a model")
    return this.model
  }

  rawCaptureModelFor(leakedToolCalls?: LeakedToolCall[]): LanguageModelV3 {
    return this.getLanguageModelWithRawCapture({
      config: mockConfig,
      callOrigin: CallOrigin.streamChatResponse_withTools,
      metadata: mockMetadata,
      leakedToolCalls,
    })
  }
  getTags(_config: LLMConfig): string[] {
    return []
  }

  parseStructuredOutputTextFor(text: string): Record<string, unknown> {
    return this.parseStructuredOutputText(text)
  }
  readStructuredOutputFor(result: {
    text: string
    output: Record<string, unknown>
  }): Record<string, unknown> {
    return this.readStructuredOutput(result)
  }
  structuredOutputMessageFor(message: LLMChatMessage): LLMChatMessage {
    return this.applySpecificToStructuredOutputMessage({ message, config: mockConfig })
  }
  groupedChunksFor(chunks: unknown[]): unknown[] {
    return this.groupStreamChunksForReadability(chunks)
  }
  sanitizeFor(text: string): string {
    return this.sanitize(text)
  }
  streamSanitizerFor(): StreamSanitizer {
    return this.createStreamSanitizer()
  }
  repeatedStepTextFilterFor(): RepeatedStepTextFilter {
    return this.createRepeatedStepTextFilter()
  }
  specificProviderOptionsFor(config: LLMConfig): SpecificProviderOptions {
    return this.buildSpecificProviderOptions({ config })
  }
}

/** A model that takes no temperature, and options of its own. */
class TestModelMgmtWithoutTemperature extends TestModelMgmt {
  protected readonly modelOptions: Record<AgentModel._Mock, ModelOptions> = {
    [AgentModel._Mock]: defineModelOptions(
      z.object({ providerOptions: z.object({ vertex: z.object({ thinkingBudget: z.number() }) }) }),
      { providerOptions: { vertex: { thinkingBudget: 0 } } },
    ),
  }
}

/** Applies a config the model's schema rejects. */
class TestModelMgmtWithInvalidConfig extends TestModelMgmt {
  protected applyConfigToModelOptions(): SpecificProviderOptions {
    return { temperature: "hot" } as unknown as SpecificProviderOptions
  }
}

function run(parts: StreamPartLike[]): { emitted: string[]; dropped: string[] } {
  const filter = new TestModelMgmt().repeatedStepTextFilterFor()
  const emitted: string[] = []
  for (const part of parts) {
    const text = filter.feed(part)
    if (text.length > 0) emitted.push(text)
  }
  const tail = filter.flush()
  if (tail.length > 0) emitted.push(tail)
  return { emitted, dropped: filter.dropped() }
}

const step = (...texts: string[]): StreamPartLike[] => [
  { type: "start-step" },
  ...texts.map((text) => ({ type: "text-delta" as const, text })),
  { type: "tool-call" },
  { type: "finish-step" },
]

describe("AISDKLLMModelMgmt", () => {
  describe("createRepeatedStepTextFilter", () => {
    it("streams a single step as is", () => {
      expect(run(step("Hel", "lo", " there"))).toEqual({
        emitted: ["Hel", "lo", " there"],
        dropped: [],
      })
    })

    it("drops the text a step repeats word for word after a tool result", () => {
      const { emitted, dropped } = run([
        ...step("Thanks, ", "all done."),
        ...step("Thanks, all", " done."),
      ])
      expect(emitted).toEqual(["Thanks, ", "all done."])
      expect(dropped).toEqual(["Thanks, all done."])
    })

    it("drops a truncated repeat too", () => {
      const { emitted, dropped } = run([...step("Thanks, all done."), ...step("Thanks, all")])
      expect(emitted).toEqual(["Thanks, all done."])
      expect(dropped).toEqual(["Thanks, all"])
    })

    it("releases a step that starts like the previous one and then says something new", () => {
      const { emitted, dropped } = run([
        ...step("Thanks."),
        ...step("Thanks", ". Your file is ", "complete."),
      ])
      expect(emitted).toEqual(["Thanks.", "Thanks. Your file is ", "complete."])
      expect(dropped).toEqual([])
    })

    it("streams a different follow-up without holding it back", () => {
      const { emitted } = run([...step("One moment."), ...step("Here ", "is the result.")])
      expect(emitted).toEqual(["One moment.", "Here ", "is the result."])
    })

    it("compares with the last step that carried text, skipping tool-only steps", () => {
      const { emitted, dropped } = run([...step("All set."), ...step(), ...step("All set.")])
      expect(emitted).toEqual(["All set."])
      expect(dropped).toEqual(["All set."])
    })

    it("keeps a repeat inside a single step, only step boundaries count", () => {
      const { emitted } = run(step("Yes. ", "Yes. "))
      expect(emitted).toEqual(["Yes. ", "Yes. "])
    })

    it("flushes held text when the stream ends without a finish-step", () => {
      const filter = new TestModelMgmt().repeatedStepTextFilterFor()
      for (const part of step("Done.")) filter.feed(part)
      filter.feed({ type: "start-step" })
      expect(filter.feed({ type: "text-delta", text: "Done." })).toBe("")
      expect(filter.flush()).toBe("")
      expect(filter.dropped()).toEqual(["Done."])
    })
  })

  describe("sanitize", () => {
    const modelMgmt = new TestModelMgmt()

    describe("hallucinated tool-call XML", () => {
      it("removes a pseudo-call tag from a complete text", () => {
        const text = `C'est noté, tu habites en France !\n\n${LEAKED_PSEUDO_CALL}`
        const cleaned = modelMgmt.sanitizeFor(text)

        expect(cleaned).not.toContain("default_api")
        expect(cleaned).not.toContain("<call:")
        expect(cleaned).toContain("C'est noté, tu habites en France !")
      })

      it("removes variants of the default_api family", () => {
        const cleaned = modelMgmt.sanitizeFor(
          'a <default_api:mandatory_tool args="x"/> b </default_api:call> c',
        )
        expect(cleaned).toBe("a  b  c")
      })

      it("removes the brace-terminated <function:> variant that has no closing angle bracket", () => {
        const text = `Je vous invite à contacter votre conseiller.\n\n${LEAKED_FUNCTION_CALL}`
        const cleaned = modelMgmt.sanitizeFor(text)

        expect(cleaned).not.toContain("default_api")
        expect(cleaned).not.toContain("<function")
        expect(cleaned).toContain("Je vous invite à contacter votre conseiller.")
      })

      it("removes the brace-terminated variant for the whole opener family", () => {
        const cleaned = modelMgmt.sanitizeFor(
          "a <call:default_api:notify_operator{severity:high} b <default_api:mandatory_tool{x:1} c",
        )
        expect(cleaned).toBe("a  b  c")
      })

      it("removes the bare variant with no angle bracket and a garbled prefix", () => {
        const text = `Bonjour ! Comment puis-je vous aider aujourd'hui ? ${LEAKED_BARE_CALL}`
        const cleaned = modelMgmt.sanitizeFor(text)

        expect(cleaned).not.toContain("default_api")
        expect(cleaned).not.toContain("Lie:")
        expect(cleaned).toBe("Bonjour ! Comment puis-je vous aider aujourd'hui ? ")
      })

      it("removes the name-only variant, whatever the tool name", () => {
        const text = `Les horaires sont affichés à l'entrée.\n\n${LEAKED_NAME_ONLY_CALL}`
        expect(modelMgmt.sanitizeFor(text)).toBe("Les horaires sont affichés à l'entrée.\n\n")
        // A hallucinated tool name must be hidden too.
        expect(modelMgmt.sanitizeFor("Réponse. some_made_up_tool{a:1,b:[x]}")).toBe("Réponse. ")
      })

      it("keeps prose with braces that do not form a key:value argument object", () => {
        const text =
          "L'outil mandatory_tool est appelé à chaque tour, function foo() {} reste, et {a, b} aussi."
        expect(modelMgmt.sanitizeFor(text)).toBe(text)
      })

      it("keeps legitimate text mentioning the function keyword", () => {
        const text = "En JS, une fonction s'écrit function foo() {} et on vérifie que 2 < 3."
        expect(modelMgmt.sanitizeFor(text)).toBe(text)
      })

      it("keeps legitimate text with angle brackets and comparisons", () => {
        const text = "En maths, 2 < 3 et 5 > 4. Le tag <b>gras</b> reste, tout comme a < b."
        expect(modelMgmt.sanitizeFor(text)).toBe(text)
      })
    })

    describe("bracketed tool name", () => {
      it("removes the tool name a model writes in square brackets instead of calling it", () => {
        expect(modelMgmt.sanitizeFor("Merci, tout est transmis.\n\n[concludeHandoff]")).toBe(
          "Merci, tout est transmis.\n\n",
        )
      })

      it("keeps markdown links, citations and plain bracketed words", () => {
        const text = "Voir [la fiche](https://example.org) et [1], puis [TODO] et [note]."
        expect(modelMgmt.sanitizeFor(text)).toBe(text)
      })
    })

    describe("wrappers around a removed call", () => {
      it("drops the <code> wrapper a model put around a verbalized call", () => {
        expect(
          modelMgmt.sanitizeFor("Je vous transfère.\n<code>DHI{reason:test}</code>\nÀ bientôt."),
        ).toBe("Je vous transfère.\n\nÀ bientôt.")
      })

      it("drops a fenced block left empty by the removal", () => {
        expect(modelMgmt.sanitizeFor("Voilà.\n```\nNVI{reason:x}\n```")).toBe("Voilà.\n")
      })

      it("keeps a code block with real content", () => {
        expect(modelMgmt.sanitizeFor("<code>const a = 1</code>")).toBe("<code>const a = 1</code>")
      })
    })
  })

  describe("createStreamSanitizer", () => {
    const modelMgmt = new TestModelMgmt()

    it("strips the pseudo-call even when split across many stream deltas", () => {
      const stripper = modelMgmt.streamSanitizerFor()
      const full = `Voici ma réponse complète pour toi, avec assez de texte pour dépasser la retenue du stripper.\n\n${LEAKED_PSEUDO_CALL}`
      let out = ""
      // 7-char deltas: the tag is split mid-emission many times over.
      for (let i = 0; i < full.length; i += 7) {
        out += stripper.feed(full.slice(i, i + 7))
      }
      out += stripper.flush()

      expect(out).not.toContain("default_api")
      expect(out).not.toContain("<call:")
      expect(out).toContain("Voici ma réponse complète")
    })

    it("strips the brace-terminated <function:> variant even when split across stream deltas", () => {
      const stripper = modelMgmt.streamSanitizerFor()
      const full = `Voici ma réponse complète pour toi, avec assez de texte pour dépasser la retenue du stripper.\n\n${LEAKED_FUNCTION_CALL}`
      let out = ""
      for (let i = 0; i < full.length; i += 7) {
        out += stripper.feed(full.slice(i, i + 7))
      }
      out += stripper.flush()

      expect(out).not.toContain("default_api")
      expect(out).not.toContain("<function")
      expect(out).toContain("Voici ma réponse complète")
    })

    it("strips the bare variant even when split across stream deltas", () => {
      const stripper = modelMgmt.streamSanitizerFor()
      const full = `Voici ma réponse complète pour toi, avec assez de texte pour dépasser la retenue du stripper.\n\n${LEAKED_BARE_CALL}`
      let out = ""
      for (let i = 0; i < full.length; i += 7) {
        out += stripper.feed(full.slice(i, i + 7))
      }
      out += stripper.flush()

      expect(out).not.toContain("default_api")
      expect(out).not.toContain("Lie:")
      expect(out).toContain("Voici ma réponse complète")
    })

    it("strips the name-only variant even when split across stream deltas", () => {
      const stripper = modelMgmt.streamSanitizerFor()
      const full = `Voici ma réponse complète pour toi, avec assez de texte pour dépasser la retenue du stripper.\n\n${LEAKED_NAME_ONLY_CALL}`
      let out = ""
      for (let i = 0; i < full.length; i += 7) {
        out += stripper.feed(full.slice(i, i + 7))
      }
      out += stripper.flush()

      expect(out).not.toContain("mandatory_tool")
      expect(out).not.toContain("suggestedTitle")
      expect(out).toContain("Voici ma réponse complète")
    })

    it("does not stall the stream on a never-closed lookalike", () => {
      const stripper = modelMgmt.streamSanitizerFor()
      const full = `Début. <call:jamais fermé ${"x".repeat(700)} fin du texte.`
      let out = ""
      for (let i = 0; i < full.length; i += 20) {
        out += stripper.feed(full.slice(i, i + 20))
      }
      out += stripper.flush()

      // The giant lookalike is not a real tag (never closed): the stream must
      // still deliver the surrounding text once the hold-back cap is passed.
      expect(out).toContain("Début.")
      expect(out).toContain("fin du texte.")
    })

    it("strips the bracketed name even when split across stream deltas", () => {
      const sanitizer = modelMgmt.streamSanitizerFor()
      const deltas = [
        "Merci, tout est transmis à l'équipe médicale pour la suite.",
        " [conclude",
        "Handoff]",
      ]
      let out = ""
      for (const delta of deltas) out += sanitizer.feed(delta)
      out += sanitizer.flush()
      expect(out).toBe("Merci, tout est transmis à l'équipe médicale pour la suite. ")
    })
  })

  describe("buildSpecificProviderOptions", () => {
    it("holds the model's options with the configured temperature", () => {
      expect(
        new TestModelMgmt().specificProviderOptionsFor({ ...mockConfig, temperature: 0.4 }),
      ).toEqual({ temperature: 0.4 })
    })

    it("sends no temperature to a model whose options take none", () => {
      const specificOptions = new TestModelMgmtWithoutTemperature().specificProviderOptionsFor({
        ...mockConfig,
        temperature: 0.4,
      })

      expect(specificOptions).toEqual({ providerOptions: { vertex: { thinkingBudget: 0 } } })
      expect(specificOptions).not.toHaveProperty("temperature")
    })

    it("rejects options that do not fit the model's schema", () => {
      expect(() =>
        new TestModelMgmtWithInvalidConfig().specificProviderOptionsFor(mockConfig),
      ).toThrow()
    })

    it("rejects a model the provider does not serve", () => {
      expect(() =>
        new TestModelMgmt().specificProviderOptionsFor({ ...mockConfig, model: "unknown-model" }),
      ).toThrow()
    })
  })

  describe("structured output hooks", () => {
    const modelMgmt = new TestModelMgmt()

    it("keeps the message as is by default", () => {
      const message: LLMChatMessage = { role: "user", content: "Give it a title." }
      expect(modelMgmt.structuredOutputMessageFor(message)).toBe(message)
    })

    it("reads the output the AI SDK parsed by default", () => {
      expect(
        modelMgmt.readStructuredOutputFor({ text: "ignored", output: { title: "Pricing" } }),
      ).toEqual({ title: "Pricing" })
    })
  })

  describe("parseStructuredOutputText", () => {
    const modelMgmt = new TestModelMgmt()

    it("parses a bare JSON object", () => {
      expect(modelMgmt.parseStructuredOutputTextFor('{"title":"Pricing"}')).toEqual({
        title: "Pricing",
      })
    })

    it("parses an object wrapped in a code fence", () => {
      expect(modelMgmt.parseStructuredOutputTextFor('```json\n{"title":"Pricing"}\n```')).toEqual({
        title: "Pricing",
      })
    })

    it("parses an object surrounded by a sentence", () => {
      expect(
        modelMgmt.parseStructuredOutputTextFor('Here is the result: {"title":"Pricing"} Done.'),
      ).toEqual({ title: "Pricing" })
    })

    it("throws a readable error when the text has no object", () => {
      expect(() => modelMgmt.parseStructuredOutputTextFor("I cannot answer that.")).toThrow(
        "Structured output is not a JSON object: I cannot answer that.",
      )
    })

    it("throws a readable error when the object is not valid JSON", () => {
      expect(() => modelMgmt.parseStructuredOutputTextFor("{title: Pricing}")).toThrow(
        "Structured output is not valid JSON",
      )
    })
  })

  describe("groupStreamChunksForReadability", () => {
    const modelMgmt = new TestModelMgmt()

    it("collapses each run of text deltas into one chunk", () => {
      expect(
        modelMgmt.groupedChunksFor([
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Our plans " },
          { type: "text-delta", id: "text-1", delta: "start at 10 euros." },
          { type: "text-end", id: "text-1" },
        ]),
      ).toEqual([
        { type: "text-stream-collapsed", id: "text-1", text: "Our plans start at 10 euros." },
      ])
    })

    it("collapses tool input and reasoning deltas, keeping the extra fields of the start chunk", () => {
      expect(
        modelMgmt.groupedChunksFor([
          { type: "reasoning-start", id: "reasoning-1" },
          { type: "reasoning-delta", id: "reasoning-1", delta: "The user asks " },
          { type: "reasoning-delta", id: "reasoning-1", delta: "for prices." },
          { type: "reasoning-end", id: "reasoning-1" },
          { type: "tool-input-start", id: "call-1", toolName: "lookup_knowledge_base" },
          { type: "tool-input-delta", id: "call-1", delta: '{"query":' },
          { type: "tool-input-delta", id: "call-1", delta: '"pricing"}' },
          { type: "tool-input-end", id: "call-1" },
        ]),
      ).toEqual([
        {
          type: "reasoning-stream-collapsed",
          id: "reasoning-1",
          text: "The user asks for prices.",
        },
        {
          type: "tool-input-stream-collapsed",
          id: "call-1",
          toolName: "lookup_knowledge_base",
          input: '{"query":"pricing"}',
        },
      ])
    })

    it("keeps the other chunks as they are, closing the run in progress first", () => {
      const finish = { type: "finish", finishReason: { unified: "stop", raw: "stop" } }
      expect(
        modelMgmt.groupedChunksFor([
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Hello" },
          finish,
        ]),
      ).toEqual([{ type: "text-stream-collapsed", id: "text-1", text: "Hello" }, finish])
    })

    it("closes a run left open at the end of the chunks", () => {
      expect(
        modelMgmt.groupedChunksFor([
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Hello" },
        ]),
      ).toEqual([{ type: "text-stream-collapsed", id: "text-1", text: "Hello" }])
    })

    it("starts a run for deltas that arrive without a start chunk", () => {
      expect(
        modelMgmt.groupedChunksFor([
          { type: "text-delta", id: "text-1", delta: "Hel" },
          { type: "text-delta", id: "text-1", delta: "lo" },
        ]),
      ).toEqual([{ type: "text-stream-collapsed", id: "text-1", text: "Hello" }])
    })
  })

  describe("getLanguageModelWithRawCapture", () => {
    const LEAKED_CALL_TEXT = "Done.\n\n<call:default_api:notify_operator{severity:high}/>"
    const usage = {
      inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 0, text: 0, reasoning: undefined },
    }
    const callOptions = {
      prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
    } as LanguageModelV3CallOptions

    let span: { setAttribute: jest.Mock }

    beforeEach(() => {
      span = { setAttribute: jest.fn() }
      jest.spyOn(trace, "getActiveSpan").mockReturnValue(span as unknown as Span)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const attribute = (name: string) =>
      span.setAttribute.mock.calls.find(([attributeName]) => attributeName === name)?.[1]

    const generateModel = (content: LanguageModelV3Content[]) =>
      new MockLanguageModelV3({
        doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
          content,
          finishReason: { unified: "stop", raw: undefined },
          usage,
          warnings: [],
          request: { body: '{"messages":[]}' },
          response: {
            id: "response-1",
            timestamp: new Date(0),
            modelId: "mock",
            body: { id: "raw-1" },
          },
        }),
      })

    const streamModel = (chunks: LanguageModelV3StreamPart[]) =>
      new MockLanguageModelV3({
        doStream: async () => ({
          stream: simulateReadableStream({ chunks }),
          request: { body: '{"messages":[]}' },
        }),
      })

    const textChunks = (text: string, size = 7): LanguageModelV3StreamPart[] => {
      const deltas: LanguageModelV3StreamPart[] = []
      for (let index = 0; index < text.length; index += size) {
        deltas.push({ type: "text-delta", id: "text-1", delta: text.slice(index, index + size) })
      }
      return [
        { type: "text-start", id: "text-1" },
        ...deltas,
        { type: "text-end", id: "text-1" },
        { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
      ]
    }

    const collect = async (model: LanguageModelV3) => {
      const { stream } = await model.doStream(callOptions)
      const streamParts: LanguageModelV3StreamPart[] = []
      const reader = stream.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) return streamParts
        streamParts.push(value)
      }
    }

    const streamedText = (streamParts: LanguageModelV3StreamPart[]) =>
      streamParts.map((part) => (part.type === "text-delta" ? part.delta : "")).join("")

    describe("generate", () => {
      it("cleans the text the model wrote and keeps the other parts", async () => {
        const toolCall: LanguageModelV3Content = {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "lookup_knowledge_base",
          input: "{}",
        }
        const model = new TestModelMgmt(
          generateModel([
            {
              type: "text",
              text: "<|channel>thought Plan the answer<channel|>Our plans start at 10.",
            },
            toolCall,
          ]),
        ).rawCaptureModelFor()

        const result = await model.doGenerate(callOptions)

        expect(result.content).toEqual([{ type: "text", text: "Our plans start at 10." }, toolCall])
      })

      it("records the raw request, the raw response and the cleaned text on the span", async () => {
        const model = new TestModelMgmt(
          generateModel([{ type: "text", text: "<|channel>thought Plan<channel|>Hello" }]),
        ).rawCaptureModelFor()

        await model.doGenerate(callOptions)

        expect(attribute(RAW_LLM_REQUEST_ATTR)).toBe('{"messages":[]}')
        expect(attribute(RAW_LLM_RESPONSE_ATTR)).toBe('{"id":"raw-1"}')
        expect(attribute(RAW_LLM_RESPONSE_STRIPPED_ATTR)).toBe("Hello")
      })

      it("records no cleaned text when there was nothing to clean", async () => {
        const model = new TestModelMgmt(
          generateModel([{ type: "text", text: "Hello" }]),
        ).rawCaptureModelFor()

        await model.doGenerate(callOptions)

        expect(attribute(RAW_LLM_RESPONSE_STRIPPED_ATTR)).toBeUndefined()
      })

      it("collects the tool calls the model verbalized in its text", async () => {
        const leakedToolCalls: LeakedToolCall[] = []
        const model = new TestModelMgmt(
          generateModel([{ type: "text", text: LEAKED_CALL_TEXT }]),
        ).rawCaptureModelFor(leakedToolCalls)

        const result = await model.doGenerate(callOptions)

        expect(leakedToolCalls.map((leakedCall) => leakedCall.name)).toEqual(["notify_operator"])
        expect(JSON.stringify(result.content)).not.toContain("<call:")
      })

      it("returns the cleaned result even when the span cannot be written", async () => {
        span.setAttribute.mockImplementation(() => {
          throw new Error("exporter down")
        })
        const model = new TestModelMgmt(
          generateModel([{ type: "text", text: "<|channel>thought Plan<channel|>Hello" }]),
        ).rawCaptureModelFor()

        const result = await model.doGenerate(callOptions)

        expect(result.content).toEqual([{ type: "text", text: "Hello" }])
      })
    })

    describe("stream", () => {
      const LONG_ANSWER =
        "Our plans start at 10 euros a month, with a yearly discount for teams of five or more. "

      it("cleans a verbalized tool call split across many deltas", async () => {
        const model = new TestModelMgmt(
          streamModel(textChunks(`${LONG_ANSWER}${LEAKED_CALL_TEXT}`)),
        ).rawCaptureModelFor()

        const text = streamedText(await collect(model))

        expect(text).toContain("Our plans start at 10 euros a month")
        expect(text).not.toContain("<call:")
        expect(text).not.toContain("notify_operator")
      })

      it("records the request, the grouped response and the cleaned text, and collects leaked calls", async () => {
        const leakedToolCalls: LeakedToolCall[] = []
        const model = new TestModelMgmt(
          streamModel(textChunks(`${LONG_ANSWER}${LEAKED_CALL_TEXT}`)),
        ).rawCaptureModelFor(leakedToolCalls)

        await collect(model)

        expect(attribute(RAW_LLM_REQUEST_ATTR)).toBe('{"messages":[]}')
        expect(JSON.parse(attribute(RAW_LLM_RESPONSE_ATTR))).toEqual([
          {
            type: "text-stream-collapsed",
            id: "text-1",
            text: `${LONG_ANSWER}${LEAKED_CALL_TEXT}`,
          },
          { type: "finish", finishReason: { unified: "stop" }, usage },
        ])
        expect(attribute(RAW_LLM_RESPONSE_STRIPPED_ATTR)).not.toContain("<call:")
        expect(leakedToolCalls.map((leakedCall) => leakedCall.name)).toEqual(["notify_operator"])
      })

      it("cleans deltas that arrive without a text-start", async () => {
        const chunks = textChunks(`${LONG_ANSWER}${LEAKED_CALL_TEXT}`).filter(
          (part) => part.type !== "text-start",
        )
        const model = new TestModelMgmt(streamModel(chunks)).rawCaptureModelFor()

        const streamParts = await collect(model)
        const text = streamedText(streamParts)

        expect(text).toContain("Our plans start at 10 euros a month")
        expect(text).not.toContain("<call:")
        expect(
          streamParts
            .filter((part) => part.type === "text-delta")
            .every((part) => part.type === "text-delta" && part.id === "text-1"),
        ).toBe(true)
      })

      it("releases the text held back when the stream ends without a text-end", async () => {
        const chunks = textChunks(`${LONG_ANSWER}Thanks.`).filter(
          (part) => part.type !== "text-start" && part.type !== "text-end",
        )
        const model = new TestModelMgmt(streamModel(chunks)).rawCaptureModelFor()

        const text = streamedText(await collect(model))

        expect(text).toBe(`${LONG_ANSWER}Thanks.`)
      })

      it("emits a tool call the provider dropped for malformed arguments", async () => {
        const model = new TestModelMgmt(
          streamModel([
            { type: "tool-input-start", id: "call-1", toolName: "record_answer" },
            { type: "tool-input-delta", id: "call-1", delta: '{"answer": "Yes"Yes"}' },
            { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
          ]),
        ).rawCaptureModelFor()

        const streamParts = await collect(model)

        expect(streamParts.map((part) => part.type)).toEqual([
          "tool-input-start",
          "tool-input-delta",
          "tool-input-end",
          "tool-call",
          "finish",
        ])
        expect(attribute("llm.tool_call.emitted_from_unfinished_input")).toBe("record_answer")
      })
    })
  })
})

import { AgentModel, AgentProvider, AgentThinkingLevel } from "@caseai-connect/api-contracts"
import { z } from "zod"
import type { LLMChatMessage, LLMConfig } from "@/common/interfaces/llm-provider.interface"
import {
  AISDKLLMModelMgmt,
  defineModelOptions,
  type ModelOptions,
  type RepeatedStepTextFilter,
  type StreamPartLike,
  type StreamSanitizer,
} from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"

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

class TestModelMgmt extends AISDKLLMModelMgmt<AgentProvider._Mock> {
  protected readonly modelOptions: Record<AgentModel._Mock, ModelOptions> = {
    [AgentModel._Mock]: defineModelOptions(
      z.object({ temperature: z.number(), providerOptions: z.object({}) }),
      { temperature: 0, providerOptions: {} },
    ),
  }

  getAgentProvider(): AgentProvider._Mock {
    return AgentProvider._Mock
  }
  getLanguageModel(): never {
    throw new Error("TestModelMgmt does not call a model")
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
})

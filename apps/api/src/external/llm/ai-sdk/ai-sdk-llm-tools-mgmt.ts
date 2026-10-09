import type { LanguageModelV3, LanguageModelV3StreamPart } from "@ai-sdk/provider"
import { Logger } from "@nestjs/common"
import {
  asSchema,
  generateText,
  InvalidToolInputError,
  Output,
  type StopCondition,
  stepCountIs,
  type ToolCallRepairFunction,
  type ToolSet,
} from "ai"
import type { LLMConfig, LLMMetadata } from "@/common/interfaces/llm-provider.interface"
import { AISDKLLMBuilders } from "@/external/llm/ai-sdk/ai-sdk-llm-builders"

// Hallucinated tool-call syntax that Gemini models (lite especially) leak
// into the TEXT stream instead of emitting a real functionCall, e.g.
// `<call:default_api:some_tool xmlns:default_api=... />` or
// `<function:default_api:some_tool{args}` (brace-terminated, no `>` at all),
// or even `Lie:default_api:some_tool{args}` (no `<` at all: the namespace is
// glued to a garbled word, and only the argument braces delimit the call).
// `default_api` is an internal Gemini tool namespace; none of these tags can
// ever be legitimate user-facing content. A tag is complete either at its
// closing `>` or, for the brace variant, at the `}` that closes its (flat)
// argument object — with an optional `/>` glued right after.
//
// Newest variant (Gemma, production): the bare tool name glued to its
// argument object, `mandatory_tool{categoryNames:[...],suggestedTitle:...}`.
// No `<`, no `call:`, no `default_api:` — the only shape left is
// `identifier{key:value,...}`. The match is tool-name agnostic on purpose:
// the model can hallucinate the name too, and a leaked call to an unknown
// tool must still be hidden (recovery then reports it as undeclared). The
// argument object must start with a `key:` so prose such as
// `function foo() {}` or `{a, b}` never matches; the identifier must not be
// glued to a preceding word char, `:` or `.` (a `default_api:` prefix stays
// with the family above, which also removes the prefix).
const BARE_CALL = String.raw`(?<![\w:.])[a-zA-Z_][a-zA-Z0-9_]*\{\s*(?:[a-zA-Z_][a-zA-Z0-9_]*\s*:[^{}]*)?\}\/?>?`
const BARE_CALL_OPEN = String.raw`(?<![\w:.])[a-zA-Z_][a-zA-Z0-9_]*\{\s*(?:[a-zA-Z_][a-zA-Z0-9_]*\s*:[^}]*)?$`
// Gemma variant: the bare tool name in square brackets, `[concludeHandoff]`,
// written as a marker at the end of the message instead of calling the tool.
// A camelCase identifier (one inner capital at least) keeps citations `[1]`
// and plain words out; a following `(` or `[` is a markdown link, kept.
const BRACKET_CALL = String.raw`\[([a-z][a-z0-9]*[A-Z][a-zA-Z0-9_]*)\](?![(\[])`
export const PSEUDO_TOOL_CALL_RE = new RegExp(
  String.raw`<\/?(?:call|function|default_api)[:\s](?:[^>{]*\{[^{}]*\}\/?>?|[^>]*\/?>)|(?:[^\s<>{}]*:)?default_api:[^\s<>{}]*\{[^{}]*\}\/?>?|${BARE_CALL}|${BRACKET_CALL}`,
  "g",
)
// An opener of that family that has no closer yet (still streaming): no `>`
// for the tag variants, no `}` for the brace variants.
export const PSEUDO_TOOL_CALL_OPEN_RE = new RegExp(
  String.raw`<\/?(?:call|function|default_api)[:\s][^>]*$|(?:[^\s<>{}]*:)?default_api:[^}]*$|${BARE_CALL_OPEN}`,
  "i",
)
// Give up holding the stream back after this many buffered characters: a
// legitimate `<call:`-looking text (vanishingly unlikely) must not stall the
// stream forever.
export const PSEUDO_TOOL_CALL_MAX_LEN = 600

/**
 * Emits the tool call a provider dropped because its arguments never became
 * valid JSON.
 *
 * The OpenAI chat provider of the AI SDK streams a tool call's arguments as
 * `tool-input-start` / `tool-input-delta` parts and emits the `tool-call`
 * part only once the accumulated arguments parse as JSON. When the model
 * (Gemma on a long form) breaks the JSON, the call is never emitted: no
 * tool result, no error, no retry, and the turn ends on an empty reply.
 *
 * This tracker watches the stream and, on `finish`, emits the missing
 * `tool-call` with the raw arguments. The SDK then rejects the arguments,
 * which hands them to the repair function, or, failing that, tells the
 * model with a tool error so it can call again.
 */
export type UnfinishedToolCallTracker = {
  /** Parts to enqueue before `chunk`: the tool calls the provider dropped. */
  before(chunk: LanguageModelV3StreamPart): LanguageModelV3StreamPart[]
  /** Names of the tool calls emitted by the tracker so far. */
  emitted(): string[]
}

/**
 * A tool call the model VERBALIZED in the text channel instead of emitting
 * it (documented Gemini failure family): the call never reached the tool
 * channel, so the platform did NOT execute it. `raw` keeps the whole leaked
 * tag — it already carries the arguments the model intended, in a malformed
 * form, which is what makes recovery possible.
 */
export type LeakedToolCall = {
  name: string
  raw: string
}

export abstract class AISDKLLMToolsMgmt extends AISDKLLMBuilders {
  /**
   * A model that VERBALIZES a tool call in the text channel instead of
   * emitting it (documented Gemini failure family) means the tool never
   * ran: the sanitizer hides the tag from the user, so without this log the
   * failure would be completely silent. Logged loudly so monitoring can
   * catch it — a tool with side effects must never fail unnoticed.
   */
  protected readonly leakedToolCallLogger = new Logger("LeakedToolCall")
  protected readonly malformedToolCallLogger = new Logger("MalformedToolCall")

  /**
   * Repairs a tool call whose arguments are not valid JSON (Gemma breaks a
   * long form now and then: a quote too many, a comma missing). The
   * arguments are regenerated through structured output, constrained by the
   * tool's schema, from the broken text: the values are there, only the
   * syntax is wrong. Returns null when the repair fails or the tool does
   * not exist: the SDK then reports the error to the model as a tool
   * result, and the model can call again.
   */
  protected buildToolCallRepair({
    model,
    config,
    metadata,
    functionId,
    tags,
  }: {
    model: LanguageModelV3
    config: LLMConfig
    metadata: LLMMetadata
    functionId: string
    tags: string[]
  }): ToolCallRepairFunction<ToolSet> {
    return async ({ toolCall, tools, error }) => {
      if (!InvalidToolInputError.isInstance(error)) return null
      const inputSchema = tools[toolCall.toolName]?.inputSchema
      if (inputSchema === undefined) return null
      try {
        const repaired = await this.regenerateToolInput({
          model,
          config,
          metadata,
          functionId,
          tags,
          inputSchema,
          instruction:
            "The arguments of a tool call are not valid JSON. Return them as valid arguments, verbatim: copy every value exactly as written, invent nothing, and drop nothing.",
          malformed: toolCall.input,
          telemetryKey: "repairedMalformedToolCall",
          toolName: toolCall.toolName,
        })
        this.malformedToolCallLogger.warn(
          `repaired the malformed arguments of "${toolCall.toolName}" through structured output`,
        )
        return { ...toolCall, input: JSON.stringify(repaired) }
      } catch (repairError) {
        this.malformedToolCallLogger.error(
          `could not repair the malformed arguments of "${toolCall.toolName}": ${repairError instanceof Error ? repairError.message : repairError}`,
        )
        return null
      }
    }
  }

  /** Structured output, constrained by the tool's schema, from a malformed rendering of the arguments. */
  private async regenerateToolInput({
    model,
    config,
    metadata,
    functionId,
    tags,
    inputSchema,
    instruction,
    malformed,
    telemetryKey,
    toolName,
  }: {
    model: LanguageModelV3
    config: LLMConfig
    metadata: LLMMetadata
    functionId: string
    tags: string[]
    inputSchema: NonNullable<Parameters<typeof asSchema>[0]>
    instruction: string
    malformed: string
    telemetryKey: string
    toolName: string
  }): Promise<unknown> {
    const regenerated = await generateText({
      model,
      temperature: config.temperature,
      messages: [
        {
          role: "user",
          content: `${instruction}

Malformed call:
${malformed}`,
        },
      ],
      output: Output.object({ schema: inputSchema }),
      experimental_telemetry: {
        isEnabled: true,
        functionId,
        metadata: { ...this.buildMetadata({ config, metadata, tags }), [telemetryKey]: toolName },
      },
      providerOptions: this.buildNativeProviderOptions({ config }),
    })
    return regenerated.output
  }

  /**
   * Recovers a tool call the model VERBALIZED in the text channel instead of
   * emitting it (documented Gemini failure family). Without this, the call
   * is simply lost: the sanitizer hides the tag from the user and nothing
   * ran, which silently drops whatever the tool was meant to do.
   *
   * Recovery deliberately does NOT re-force a tool call: the model that
   * leaked is the one that would be asked again, and the whole failure mode
   * is "wrong channel". Instead it uses STRUCTURED OUTPUT (no tool channel
   * involved, arguments grammar-constrained by the schema) to convert the
   * leaked tag — which already carries the intended arguments in a
   * malformed form — into valid input, validated by the tool's own schema
   * before the tool executes.
   *
   * One attempt per tool, skipped when the tool already executed in the
   * turn. Deduplicating repeated deliveries is the destination's job (e.g.
   * the MCP server). Best-effort: the user already got their answer, so
   * failures are logged loudly and never break the stream.
   */
  protected async recoverLeakedToolCalls({
    model,
    config,
    metadata,
    functionId,
    leakedToolCalls,
    streamResult,
    tags,
  }: {
    model: LanguageModelV3
    config: LLMConfig
    metadata: LLMMetadata
    functionId: string
    leakedToolCalls: LeakedToolCall[]
    streamResult: {
      steps: PromiseLike<Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>>
    }
    tags: string[]
  }): Promise<void> {
    if (leakedToolCalls.length === 0) return
    const tools = config.tools
    if (!tools) return

    let executedToolNames: Set<string>
    try {
      const steps = await streamResult.steps
      executedToolNames = new Set(
        steps.flatMap((step) => step.toolResults.map((toolResult) => toolResult.toolName)),
      )
    } catch (error) {
      this.leakedToolCallLogger.error(
        `leaked tool call recovery failed: ${error instanceof Error ? error.message : error}`,
      )
      return
    }

    // Each call is recovered on its own: one that fails must not drop the next ones.
    for (const leakedCall of leakedToolCalls) {
      if (executedToolNames.has(leakedCall.name)) continue
      try {
        await this.recoverLeakedToolCall({
          model,
          config,
          metadata,
          functionId,
          leakedCall,
          tools,
          tags,
        })
      } catch (error) {
        this.leakedToolCallLogger.error(
          `could not recover the leaked call to "${leakedCall.name}": ${error instanceof Error ? error.message : error}`,
        )
      }
    }
  }

  private async recoverLeakedToolCall({
    model,
    config,
    metadata,
    functionId,
    leakedCall,
    tools,
    tags,
  }: {
    model: LanguageModelV3
    config: LLMConfig
    metadata: LLMMetadata
    functionId: string
    leakedCall: LeakedToolCall
    tools: ToolSet
    tags: string[]
  }): Promise<void> {
    const tool = tools[leakedCall.name]
    if (!tool?.execute) {
      this.leakedToolCallLogger.error(
        `cannot recover leaked call to "${leakedCall.name}": tool not declared or not executable`,
      )
      return
    }

    // A tool without arguments (a conclusion, a hand-back) has nothing to
    // regenerate: the leaked name is the whole call.
    const toolJsonSchema = await asSchema(tool.inputSchema).jsonSchema
    if (Object.keys(toolJsonSchema.properties ?? {}).length === 0) {
      await tool.execute({}, { toolCallId: `recovered-${leakedCall.name}`, messages: [] })
      this.leakedToolCallLogger.warn(
        `recovered the leaked call to "${leakedCall.name}" (no arguments) and executed it`,
      )
      return
    }

    // The structured output is validated against the tool's own schema, the
    // last gate before a side effect runs: arguments that do not fit throw.
    const recoveredInput = await generateText({
      model,
      temperature: config.temperature,
      messages: [
        {
          role: "user",
          content: `A tool call was emitted as malformed text instead of a real tool call. Convert it into the tool's arguments, verbatim — copy every value exactly as written, invent nothing, and drop nothing.

Malformed call:
${leakedCall.raw}`,
        },
      ],
      output: Output.object({ schema: tool.inputSchema }),
      experimental_telemetry: {
        isEnabled: true,
        functionId,
        metadata: {
          ...this.buildMetadata({ config, metadata, tags }),
          recoveredLeakedToolCall: leakedCall.name,
        },
      },
      providerOptions: this.buildNativeProviderOptions({ config }),
    })

    await tool.execute(recoveredInput.output, {
      toolCallId: `recovered-${leakedCall.name}`,
      messages: [],
    })
    this.leakedToolCallLogger.warn(
      `recovered the leaked call to "${leakedCall.name}" through structured output and executed it`,
    )
  }

  /** The tool calls verbalized in `text`, one per tool name (see {@link LeakedToolCall}). */
  protected findLeakedToolCalls(text: string): LeakedToolCall[] {
    const byName = new Map<string, LeakedToolCall>()
    // The leaked tag is malformed and comes in variants; the tool name is the
    // last `:`-separated segment of the tag opener, before its arguments
    // (`{...}`, ` attr=...`, or the closing `>`).
    for (const match of text.matchAll(PSEUDO_TOOL_CALL_RE)) {
      const raw = match[0]
      const opener =
        /(?:<\/?(?:call|function)[:\s]|<?\/?(?:[^\s<>{}]*:)?default_api[:\s])([^>{(\s]+)/i.exec(raw)
      // Bare `identifier{...}` variant: the identifier is the tool name.
      const bareName = opener === null ? /^[a-zA-Z_][a-zA-Z0-9_]*(?=\{)/.exec(raw)?.[0] : undefined
      // Bracketed `[identifier]` variant.
      const bracketName =
        opener === null ? /^\[([a-zA-Z_][a-zA-Z0-9_]*)\]$/.exec(raw)?.[1] : undefined
      const segments = (opener?.[1] ?? bareName ?? bracketName ?? "").split(":").filter(Boolean)
      const name = segments.at(-1)
      if (name && name !== "default_api" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        if (!byName.has(name)) byName.set(name, { name, raw })
      }
    }
    return [...byName.values()]
  }

  protected logLeakedToolCalls({
    originalText,
    config,
    leakedToolCalls,
  }: {
    originalText: string
    config?: LLMConfig
    leakedToolCalls?: LeakedToolCall[]
  }): void {
    try {
      const found = this.findLeakedToolCalls(originalText)
      if (found.length === 0) return
      const leakedToolNames = found.map((leakedCall) => leakedCall.name)
      leakedToolCalls?.push(...found)
      const declaredToolNames = Object.keys(config?.tools ?? {})
      this.leakedToolCallLogger.error(
        `model verbalized tool call(s) in the text channel instead of calling them — NOT executed: ${JSON.stringify(
          leakedToolNames,
        )} (declared: ${JSON.stringify(declaredToolNames)}, model: ${config?.model})`,
      )
    } catch {
      // never let diagnostics break the generation
    }
  }
  /**
   * Skips the follow-up generation when a step only ran fire-and-forget tools
   * (their output is noise), and ends the turn once a terminal tool (a
   * hand-over) ran. Returns undefined when neither applies: the SDK then uses
   * its default, stepCountIs(20), which a list of conditions must repeat since
   * it replaces that default.
   */
  protected buildStopConditions({
    fireAndForgetToolNames,
    terminalToolNames,
  }: LLMConfig): StopCondition<ToolSet>[] | undefined {
    if (!fireAndForgetToolNames?.length && !terminalToolNames?.length) return undefined
    const stopConditions: StopCondition<ToolSet>[] = [stepCountIs(20)]
    if (fireAndForgetToolNames?.length)
      stopConditions.push(this.fireAndForgetStopCondition({ fireAndForgetToolNames }))
    if (terminalToolNames?.length)
      stopConditions.push(this.terminalToolsStopCondition({ terminalToolNames }))
    return stopConditions
  }

  /**
   * Stops the tool loop once the last step only invoked fire-and-forget tools —
   * logging-style tools (surfaceResources, ...) whose output the model never
   * needs. Running another generation after them would only produce an empty
   * follow-up, so skipping it saves one LLM round-trip per call.
   *
   * The loop keeps going when the step mixes fire-and-forget calls with
   * round-trip calls, and when no text was produced yet — stopping there would
   * leave the user with no answer at all.
   */
  protected fireAndForgetStopCondition({
    fireAndForgetToolNames,
  }: {
    fireAndForgetToolNames: string[]
  }): StopCondition<ToolSet> {
    const fireAndForgetTools = new Set(fireAndForgetToolNames)
    return ({ steps }) => {
      const lastStep = steps.at(-1)
      if (!lastStep || lastStep.toolCalls.length === 0) return false
      const onlyFireAndForgetCalls = lastStep.toolCalls.every((toolCall) =>
        fireAndForgetTools.has(toolCall.toolName),
      )
      if (!onlyFireAndForgetCalls) return false
      return steps.some((step) => step.text.trim().length > 0)
    }
  }

  /**
   * Ends the tool loop once a terminal tool ran (a hand-over to a sub-agent).
   * The step that called it may carry the model's closing sentence; when it
   * does not, one more generation is allowed for that sentence, then the loop
   * stops whatever the model produces. Without this a model that keeps going
   * after the hand-over calls other tools (a second hand-over overriding the
   * first) or talks in the sub-agent's place.
   */
  protected terminalToolsStopCondition({
    terminalToolNames,
  }: {
    terminalToolNames: string[]
  }): StopCondition<ToolSet> {
    const terminalTools = new Set(terminalToolNames)
    return ({ steps }) => {
      const terminalStepIndex = steps.findIndex((step) =>
        step.toolCalls.some((toolCall) => terminalTools.has(toolCall.toolName)),
      )
      if (terminalStepIndex === -1) return false
      const lastStep = steps.at(-1)
      if (!lastStep) return false
      if (lastStep.text.trim().length > 0) return true
      return steps.length > terminalStepIndex + 1
    }
  }

  /** See {@link UnfinishedToolCallTracker}. One tracker per stream. */
  protected createUnfinishedToolCallTracker(): UnfinishedToolCallTracker {
    const started = new Map<string, { toolName: string; input: string; ended: boolean }>()
    const called = new Set<string>()
    const emittedToolNames: string[] = []

    const synthesize = (): LanguageModelV3StreamPart[] => {
      const parts: LanguageModelV3StreamPart[] = []
      for (const [id, toolInput] of started) {
        if (called.has(id)) continue
        if (!toolInput.ended) parts.push({ type: "tool-input-end", id })
        parts.push({
          type: "tool-call",
          toolCallId: id,
          toolName: toolInput.toolName,
          input: toolInput.input,
        })
        called.add(id)
        emittedToolNames.push(toolInput.toolName)
      }
      return parts
    }

    return {
      before(chunk) {
        switch (chunk.type) {
          case "tool-input-start":
            if (!chunk.providerExecuted) {
              started.set(chunk.id, { toolName: chunk.toolName, input: "", ended: false })
            }
            return []
          case "tool-input-delta": {
            const toolInput = started.get(chunk.id)
            if (toolInput) toolInput.input += chunk.delta
            return []
          }
          case "tool-input-end": {
            const toolInput = started.get(chunk.id)
            if (toolInput) toolInput.ended = true
            return []
          }
          case "tool-call":
            called.add(chunk.toolCallId)
            return []
          case "finish":
            return synthesize()
          default:
            return []
        }
      },
      emitted() {
        return [...emittedToolNames]
      },
    }
  }

  /**
   * Marks every tool of the set `strict: true` WITHOUT materializing it: each
   * wrapper keeps the original tool as its prototype, so a tool that exposes
   * getter-based properties keeps being re-evaluated on every generation and
   * the caller's tool objects stay untouched.
   *
   * On the ai-sdk Google/Vertex provider, a strict tool switches the request
   * to functionCallingConfig mode VALIDATED: Gemini then constrains the call
   * arguments to the declared schema (enums held even under adversarial user
   * injections — measured) while still answering with text in the same
   * generation, which neither AUTO (no validation) nor ANY (no text) offers.
   */
  protected withStrictTools(tools: ToolSet | undefined): ToolSet | undefined {
    if (!tools) return undefined
    return Object.fromEntries(
      Object.entries(tools).map(([toolName, tool]) => [
        toolName,
        Object.create(tool, { strict: { value: true, enumerable: true } }),
      ]),
    )
  }

  /**
   * Providers whose backend enforces tool argument schemas when tools are
   * marked `strict` opt in here (Vertex Gemini: mode VALIDATED).
   */
  protected supportsStrictTools(): boolean {
    return false
  }
}

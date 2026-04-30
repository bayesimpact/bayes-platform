//https://github.com/langfuse/langfuse-js/blob/v3.38.6/langfuse-vercel/src/LangfuseExporter.ts

import type { ExportResult, ExportResultCode } from "@opentelemetry/core"
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base"
import type { LangfuseGenerationClient, LangfusePromptRecord } from "langfuse"
import type { components } from "langfuse-core"
import { Langfuse, type LangfuseOptions } from "langfuse-v2"

type LangfuseExporterParams = {
  publicKey?: string
  secretKey?: string
  baseUrl?: string
  debug?: boolean
} & LangfuseOptions

type SpanExporterAttributes = Record<string, SpanExporterAttribute | undefined>
type SpanExporterAttribute =
  | string
  | number
  | boolean
  | (null | undefined | string)[]
  | (null | undefined | number)[]
  | (null | undefined | boolean)[]

export class LangfuseIntegrationExporter implements SpanExporter {
  static langfuse: Langfuse | null = null // Singleton instance
  private readonly debug: boolean
  private readonly langfuse: Langfuse

  constructor(params: LangfuseExporterParams = {}) {
    this.debug = params.debug ?? false

    if (!LangfuseIntegrationExporter.langfuse) {
      LangfuseIntegrationExporter.langfuse = new Langfuse({
        ...params,
        persistence: "memory",
        sdkIntegration: "vercel-ai-sdk",
      })

      if (this.debug) {
        LangfuseIntegrationExporter.langfuse.debug()
      }
    }

    this.langfuse = LangfuseIntegrationExporter.langfuse // store reference to singleton instance
  }

  async export(
    allSpans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): Promise<void> {
    this.logDebug("exporting spans", allSpans)

    try {
      const traceSpanMap = new Map<string, ReadableSpan[]>()

      for (const span of allSpans) {
        if (!this.isAiSdkSpan(span)) {
          this.logDebug(`Skip non-AI SDK span ${span.name}`)
          continue
        }
        const traceId = span.spanContext().traceId
        traceSpanMap.set(traceId, (traceSpanMap.get(traceId) ?? []).concat(span))
      }

      for (const [traceId, spans] of traceSpanMap) {
        this.processTraceSpans(traceId, spans)
      }

      await this.langfuse.flushAsync()

      const successCode: ExportResultCode.SUCCESS = 0

      resultCallback({ code: successCode })
    } catch (err) {
      const failureCode: ExportResultCode.FAILED = 1

      resultCallback({
        code: failureCode,
        error: err instanceof Error ? err : new Error("Unknown error"),
      })
    }
  }

  private processTraceSpans(traceId: string, spans: ReadableSpan[]): void {
    const rootSpan = spans.find((span) => this.isRootAiSdkSpan(span))

    const userProvidedTraceId = this.parseTraceId(spans)
    const finalTraceId = userProvidedTraceId ?? traceId
    const langfusePrompt = this.parseLangfusePromptTraceAttribute(spans)
    const updateParent = this.parseLangfuseUpdateParentTraceAttribute(spans)
    const currentTurn = this.parseCurrentTurnTraceAttribute(spans)

    const finalTraceParams =
      rootSpan && updateParent
        ? {
            id: finalTraceId,
            userId: this.parseUserIdTraceAttribute(spans),
            sessionId: this.parseSessionIdTraceAttribute(spans),
            tags:
              this.parseTagsTraceAttribute(spans).length > 0
                ? this.parseTagsTraceAttribute(spans)
                : undefined,
            name: this.parseTraceName(spans) ?? rootSpan.name,
            input: this.parseInput(rootSpan),
            output: this.parseOutput(rootSpan),
            // metadata: this.filterTraceAttributes(this.parseMetadataTraceAttribute(spans)),
            metadata: this.parseMetadataTraceAttribute(spans),
          }
        : { id: finalTraceId }

    this.langfuse.trace(finalTraceParams)

    for (const span of spans.sort((a, b) => {
      const [as, an] = a.startTime
      const [bs, bn] = b.startTime
      if (as !== bs) return as - bs
      return an - bn
    })) {
      if (this.isGenerationSpan(span)) {
        this.processSpanAsLangfuseGeneration(finalTraceId, span, langfusePrompt)
      } else {
        this.processSpanAsLangfuseSpan(
          finalTraceId,
          span,
          this.isRootAiSdkSpan(span),
          currentTurn
            ? `Turn #${currentTurn}`
            : userProvidedTraceId
              ? this.parseTraceName(spans)
              : undefined,
        )
      }
    }
  }

  private processSpanAsLangfuseSpan(
    traceId: string,
    span: ReadableSpan,
    isRootSpan: boolean,
    rootSpanName?: string,
  ): void {
    const spanContext = span.spanContext()
    const attributes = span.attributes
    const isToolCall = "ai.toolCall.name" in attributes

    const parentObservationId = this.getParentSpanId(span) ?? undefined

    if (isToolCall)
      this.langfuse.event({
        traceId,
        parentObservationId,
        id: spanContext.spanId,
        name: `ai.toolCall ${attributes["ai.toolCall.name"]?.toString()}`,
        startTime: this.hrTimeToDate(span.startTime),
        input: this.parseInput(span),
        output: this.parseOutput(span),
        // metadata: this.filterTraceAttributes(this.parseSpanMetadata(span)),
        metadata: this.parseSpanMetadata(span),
      })
    else
      this.langfuse.span({
        traceId,
        parentObservationId,
        id: spanContext.spanId,
        name: isRootSpan && rootSpanName ? rootSpanName : span.name,
        startTime: this.hrTimeToDate(span.startTime),
        endTime: this.hrTimeToDate(span.endTime),

        input: this.parseInput(span),
        output: this.parseOutput(span),
        // metadata: this.filterTraceAttributes(this.parseSpanMetadata(span)),
        metadata: this.parseSpanMetadata(span),
      })
  }

  private processSpanAsLangfuseGeneration(
    traceId: string,
    span: ReadableSpan,
    langfusePrompt: LangfusePromptRecord | undefined,
  ): void {
    const spanContext = span.spanContext()
    const attributes = span.attributes

    const generation = this.langfuse.generation({
      traceId,
      parentObservationId: this.getParentSpanId(span) ?? undefined,
      id: spanContext.spanId,
      name: span.name,
      startTime: this.hrTimeToDate(span.startTime),
      endTime: this.hrTimeToDate(span.endTime),
      completionStartTime:
        "ai.response.msToFirstChunk" in attributes
          ? new Date(
              this.hrTimeToDate(span.startTime).getTime() +
                Number(attributes["ai.response.msToFirstChunk"]),
            )
          : "ai.response.msToFirstChunk" in attributes
            ? new Date(
                this.hrTimeToDate(span.startTime).getTime() +
                  Number(attributes["ai.response.msToFirstChunk"]),
              )
            : "ai.stream.msToFirstChunk" in attributes //  Legacy support for ai SDK versions < 4.0.0
              ? new Date(
                  this.hrTimeToDate(span.startTime).getTime() +
                    Number(attributes["ai.stream.msToFirstChunk"]),
                )
              : undefined,
      model:
        "ai.response.model" in attributes
          ? attributes["ai.response.model"]?.toString()
          : "gen_ai.request.model" in attributes
            ? attributes["gen_ai.request.model"]?.toString()
            : "ai.model.id" in attributes
              ? attributes["ai.model.id"]?.toString()
              : undefined,
      modelParameters: {
        toolChoice:
          "ai.prompt.toolChoice" in attributes
            ? (attributes["ai.prompt.toolChoice"]?.toString() ?? null)
            : null,
        maxTokens:
          "gen_ai.request.max_tokens" in attributes
            ? (attributes["gen_ai.request.max_tokens"]?.toString() ?? null)
            : null,
        finishReason:
          "gen_ai.response.finish_reasons" in attributes
            ? (attributes["gen_ai.response.finish_reasons"]?.toString() ?? null)
            : "gen_ai.finishReason" in attributes //  Legacy support for ai SDK versions < 4.0.0
              ? (attributes["gen_ai.finishReason"]?.toString() ?? null)
              : null,
        system:
          "gen_ai.system" in attributes
            ? (attributes["gen_ai.system"]?.toString() ?? null)
            : "ai.model.provider" in attributes
              ? (attributes["ai.model.provider"]?.toString() ?? null)
              : null,
        maxRetries:
          "ai.settings.maxRetries" in attributes
            ? (attributes["ai.settings.maxRetries"]?.toString() ?? null)
            : null,
        mode:
          "ai.settings.mode" in attributes
            ? (attributes["ai.settings.mode"]?.toString() ?? null)
            : null,
        temperature:
          "gen_ai.request.temperature" in attributes
            ? (attributes["gen_ai.request.temperature"]?.toString() ?? null)
            : null,
      },
      usage: this.parseUsageDetails(attributes),
      usageDetails: this.parseUsageDetails(attributes) as components["schemas"]["UsageDetails"],
      input: this.parseInput(span),
      output: this.parseOutput(span),

      // metadata: this.filterTraceAttributes(this.parseSpanMetadata(span)),
      metadata: this.parseSpanMetadata(span),
      prompt: langfusePrompt,
    })
    this.checkErrors(span, generation)
  }

  private checkErrors(span: ReadableSpan, generation: LangfuseGenerationClient) {
    if (span.events && span.events.length > 0) {
      if (span.events[0]?.name === "exception") {
        const event = span.events[0]
        const attributes = event.attributes ?? {}
        let message = "unknown error"
        if (
          typeof attributes["exception.type"] === "string" &&
          typeof attributes["exception.message"] === "string"
        )
          message = `${attributes["exception.type"]} : ${attributes["exception.message"]}`
        generation.update({
          level: "ERROR",
          statusMessage: message?.toString(),
        })
      }
    }
    const { isError, message } = this.checkErrorInToolResult(span)
    if (isError) {
      generation.update({
        level: "ERROR",
        statusMessage: message?.toString(),
      })
    }
  }

  private parseUsageDetails(attributes: SpanExporterAttributes): SpanExporterAttributes {
    return {
      input:
        "gen_ai.usage.prompt_tokens" in attributes // Backward compat, input_tokens used in latest ai SDK versions
          ? parseInt(attributes["gen_ai.usage.prompt_tokens"]?.toString() ?? "0", 10)
          : "gen_ai.usage.input_tokens" in attributes
            ? parseInt(attributes["gen_ai.usage.input_tokens"]?.toString() ?? "0", 10)
            : undefined,

      output:
        "gen_ai.usage.completion_tokens" in attributes // Backward compat, output_tokens used in latest ai SDK versions
          ? parseInt(attributes["gen_ai.usage.completion_tokens"]?.toString() ?? "0", 10)
          : "gen_ai.usage.output_tokens" in attributes
            ? parseInt(attributes["gen_ai.usage.output_tokens"]?.toString() ?? "0", 10)
            : undefined,
      total:
        "ai.usage.tokens" in attributes
          ? parseInt(attributes["ai.usage.tokens"]?.toString() ?? "0", 10)
          : undefined,
    }
  }

  private parseSpanMetadata(span: ReadableSpan): SpanExporterAttributes {
    return Object.entries(span.attributes).reduce((acc, [key, value]) => {
      const metadataPrefix = "ai.telemetry.metadata."

      if (key.startsWith(metadataPrefix) && value != null) {
        const strippedKey = key.slice(metadataPrefix.length)
        acc[strippedKey] = value
      }

      const spanKeysToAdd = [
        "ai.settings.maxToolRoundtrips",
        "ai.prompt.format",
        "ai.toolCall.id",
        "ai.schema",
        "ai.response.providerMetadata",
        "ai.provider.model",
        "ai.model.provider",
        "ai.model.id",
        "ai.settings.temperature",
        "ai.settings.maxRetries",
      ]

      if (spanKeysToAdd.includes(key) && value != null) {
        acc[key] = value
      }

      return acc
    }, {} as SpanExporterAttributes)
  }

  private isGenerationSpan(span: ReadableSpan): boolean {
    const generationSpanNameParts = ["doGenerate", "doStream", "doEmbed"]
    return generationSpanNameParts.some((part) => span.name.includes(part))
  }

  private isAiSdkSpan(span: ReadableSpan): boolean {
    // compat with OTEL SDKs v1 and v2
    // https://github.com/open-telemetry/opentelemetry-js/releases/tag/v2.0.0
    const instrumentationScopeName =
      // biome-ignore lint/suspicious/noExplicitAny: specific
      (span as any).instrumentationLibrary?.name ?? (span as any).instrumentationScope?.name
    return instrumentationScopeName === "ai"
  }

  private isRootAiSdkSpan(span: ReadableSpan): boolean {
    // A span is the trace root only when it has no OTEL parent at all. We do
    // NOT use "parent missing from current batch" as the criterion — children
    // arriving in later export batches must still link to their real parent.
    return !this.getParentSpanId(span)
  }

  private logDebug(message: string, spans?: ReadableSpan[]): void {
    if (!this.debug) {
      return
    }

    console.log(`[${new Date().toISOString()}] [LangfuseExporter] ${message}`, ...(spans ?? []))
  }

  private getParentSpanId(span: ReadableSpan): string | null | undefined {
    // Typecast necessary for OTEL v1 v2 compat
    // https://github.com/open-telemetry/opentelemetry-js/releases/tag/v2.0.0
    // biome-ignore lint/suspicious/noExplicitAny: specific
    return (span as any).parentSpanId ?? (span as any).parentSpanContext?.spanId
  }

  private hrTimeToDate(hrtime: [number, number]): Date {
    const nanoSeconds = hrtime[0] * 1e9 + hrtime[1]
    const milliSeconds = nanoSeconds / 1e6

    return new Date(milliSeconds)
  }

  async forceFlush(): Promise<void> {
    this.logDebug("Force flushing Langfuse...")

    await this.langfuse.flushAsync()
  }

  async shutdown(): Promise<void> {
    this.logDebug("Shutting down Langfuse...")

    await this.langfuse.shutdownAsync()
  }

  private checkErrorInToolResult(span: ReadableSpan): { isError: boolean; message?: string } {
    //fixme DOO: fix the flag error is on the previous generation :(
    let isError = false
    let message: string = ""
    const attributes = span.attributes
    const toolCalls =
      "ai.response.toolCalls" in attributes ? (attributes["ai.response.toolCalls"] as string) : "[]"
    const toolCallsArray = JSON.parse(toolCalls)
    if (toolCalls && toolCallsArray?.length > 0) {
      for (const toolCall of toolCallsArray) {
        const error = "error" in toolCall ? toolCall.error : undefined
        if (error) {
          message += `${JSON.stringify(error)}
`
          isError = true
        }
      }
    }

    return { isError, message }
  }

  private parseInput(span: ReadableSpan): (typeof span.attributes)[0] | undefined {
    const attributes = span.attributes
    const tools = "ai.prompt.tools" in attributes ? attributes["ai.prompt.tools"] : []

    // biome-ignore lint/suspicious/noExplicitAny: specific
    let chatMessages: any[] = []
    if ("ai.prompt.messages" in attributes) {
      chatMessages = [attributes["ai.prompt.messages"]]
      try {
        chatMessages = JSON.parse(attributes["ai.prompt.messages"] as string)
        chatMessages = this.removeFileBase64Data(chatMessages)
      } catch {}
    }

    let aiPrompt: any
    if ("ai.prompt" in attributes) {
      aiPrompt = attributes["ai.prompt"]
      try {
        aiPrompt = JSON.parse(attributes["ai.prompt"] as string)
        aiPrompt = this.removeFileBase64Data(aiPrompt)
      } catch {}
    }

    return "ai.prompt.messages" in attributes
      ? [...chatMessages, ...(Array.isArray(tools) ? tools : [])]
      : "ai.prompt" in attributes
        ? aiPrompt
        : "ai.toolCall.args" in attributes
          ? attributes["ai.toolCall.args"]
          : undefined
  }
  private removeFileBase64Data(input: any): any {
    if (input === null || typeof input !== "object") return input

    if (Array.isArray(input)) {
      return input.map((i) => this.removeFileBase64Data(i))
    }

    if (
      typeof input.type === "string" &&
      input.type === "file" &&
      (typeof input.data === "string" || typeof input.data === "object")
    ) {
      return {
        ...input,
        data: "<not available>",
      }
    }

    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, this.removeFileBase64Data(value)]),
    )
  }

  private parseOutput(span: ReadableSpan): (typeof span.attributes)[0] | undefined {
    const attributes = span.attributes

    return "ai.response.text" in attributes
      ? attributes["ai.response.text"]
      : "ai.result.text" in attributes // Legacy support for ai SDK versions < 4.0.0
        ? attributes["ai.result.text"]
        : "ai.toolCall.result" in attributes
          ? attributes["ai.toolCall.result"]
          : "ai.response.object" in attributes
            ? attributes["ai.response.object"]
            : "ai.result.object" in attributes // Legacy support for ai SDK versions < 4.0.0
              ? attributes["ai.result.object"]
              : "ai.response.toolCalls" in attributes
                ? attributes["ai.response.toolCalls"]
                : "ai.result.toolCalls" in attributes // Legacy support for ai SDK versions < 4.0.0
                  ? attributes["ai.result.toolCalls"]
                  : undefined
  }

  private parseTraceId(spans: ReadableSpan[]): string | undefined {
    return spans
      .map((span) => this.parseSpanMetadata(span).langfuseTraceId)
      .find((id) => Boolean(id))
      ?.toString()
  }

  private parseTraceName(spans: ReadableSpan[]): string | undefined {
    return spans
      .map((span) => span.attributes["resource.name"])
      .find((name) => Boolean(name))
      ?.toString()
  }

  private parseUserIdTraceAttribute(spans: ReadableSpan[]): string | undefined {
    return spans
      .map((span) => this.parseSpanMetadata(span).userId)
      .find((id) => Boolean(id))
      ?.toString()
  }

  private parseSessionIdTraceAttribute(spans: ReadableSpan[]): string | undefined {
    return spans
      .map((span) => this.parseSpanMetadata(span).sessionId)
      .find((id) => Boolean(id))
      ?.toString()
  }

  private parseCurrentTurnTraceAttribute(spans: ReadableSpan[]): string | undefined {
    return spans
      .map((span) => this.parseSpanMetadata(span).currentTurn)
      .find((id) => Boolean(id))
      ?.toString()
  }

  private parseLangfusePromptTraceAttribute(
    spans: ReadableSpan[],
  ): LangfusePromptRecord | undefined {
    const jsonPrompt = spans
      .map((span) => this.parseSpanMetadata(span).langfusePrompt)
      .find((prompt) => Boolean(prompt))

    try {
      if (jsonPrompt) {
        const parsedPrompt = JSON.parse(jsonPrompt.toString())

        if (
          typeof parsedPrompt !== "object" ||
          !(
            parsedPrompt.name &&
            parsedPrompt.version &&
            typeof parsedPrompt.isFallback === "boolean"
          )
        ) {
          return undefined
        }

        return parsedPrompt
      }
    } catch (_e) {
      return undefined
    }
  }

  private parseLangfuseUpdateParentTraceAttribute(spans: ReadableSpan[]): boolean {
    return Boolean(
      spans
        .map((span) => this.parseSpanMetadata(span).langfuseUpdateParent)
        .find((val) => val != null) ?? true, // default to true if no attribute is set
    )
  }

  private parseTagsTraceAttribute(spans: ReadableSpan[]): string[] {
    return [
      ...new Set(
        spans
          .map((span) => this.parseSpanMetadata(span).tags)
          .filter((tags) => Array.isArray(tags) && tags.every((tag) => typeof tag === "string"))
          .reduce((acc, tags) => acc.concat(tags as string[]), []),
      ),
    ]
  }

  private parseMetadataTraceAttribute(spans: ReadableSpan[]): SpanExporterAttributes {
    return spans.reduce((acc, span) => {
      const metadata = this.parseSpanMetadata(span)

      for (const [key, value] of Object.entries(metadata)) {
        if (value) {
          acc[key] = value
        }
      }

      return acc
    }, {} as SpanExporterAttributes)
  }

  private filterTraceAttributes(obj: SpanExporterAttributes): SpanExporterAttributes {
    const langfuseTraceAttributes = [
      "userId",
      "sessionId",
      "tags",
      "langfuseTraceId",
      "langfusePrompt",
      "langfuseUpdateParent",
      "currentTurn",
    ]

    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (!langfuseTraceAttributes.includes(key)) {
        acc[key] = value
      }

      return acc
    }, {} as SpanExporterAttributes)
  }
}

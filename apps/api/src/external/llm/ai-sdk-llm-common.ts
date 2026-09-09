export const RAW_LLM_REQUEST_ATTR = "ai.telemetry.metadata.rawLlmRequest"
export const RAW_LLM_RESPONSE_ATTR = "ai.telemetry.metadata.rawLlmResponse"
export const RAW_LLM_RESPONSE_STRIPPED_ATTR = "ai.telemetry.metadata.rawLlmResponseStripped"

export function extractTextFromContent(content: unknown): string {
  if (!Array.isArray(content)) return ""
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("")
}

export function extractTextFromStreamChunks(chunks: unknown[]): string {
  let text = ""
  for (const chunk of chunks) {
    if (
      typeof chunk === "object" &&
      chunk !== null &&
      (chunk as { type?: unknown }).type === "text-delta" &&
      typeof (chunk as { delta?: unknown }).delta === "string"
    ) {
      text += (chunk as { delta: string }).delta
    }
  }
  return text
}

export enum CallOrigin {
  streamChatResponse = "streamChatResponse",
  streamChatResponse_withTools = "streamChatResponse_withTools",
  generateText = "generateText",
  generateStructuredOutput = "generateStructuredOutput",
}

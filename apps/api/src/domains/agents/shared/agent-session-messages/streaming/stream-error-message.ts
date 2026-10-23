/**
 * The message a user reads in the chat when a turn fails. The raw error keeps
 * its provider wording for the logs; only what is shown and persisted on the
 * assistant message goes through here.
 */
export const CONTEXT_WINDOW_EXCEEDED_MESSAGE =
  "The conversation and the documents retrieved for this question are too long for the model. Ask a narrower question or start a new conversation."

/**
 * Providers describe an overflowed window in their own words: vLLM and
 * OpenAI-compatible servers say "maximum context length", Vertex says the
 * input token count exceeds the maximum, Mistral says "too many tokens".
 */
const CONTEXT_WINDOW_EXCEEDED_PATTERNS = [
  /maximum context length/i,
  /context[_ ]length[_ ]exceeded/i,
  /context window/i,
  /input token count .* exceeds/i,
  /too many tokens/i,
  /prompt is too long/i,
]

export function isContextWindowExceededError(error: unknown): boolean {
  const message = errorMessageOf(error)
  return CONTEXT_WINDOW_EXCEEDED_PATTERNS.some((pattern) => pattern.test(message))
}

/** The message shown to the user and stored on the failed assistant message. */
export function userFacingStreamErrorMessage(error: unknown): string {
  if (isContextWindowExceededError(error)) return CONTEXT_WINDOW_EXCEEDED_MESSAGE
  return error instanceof Error ? error.message : "Unknown error occurred"
}

function errorMessageOf(error: unknown): string {
  if (!(error instanceof Error)) return ""
  // An APICallError carries the provider's JSON body, which holds the wording
  // when the message itself is a generic "Bad Request".
  const responseBody = (error as { responseBody?: unknown }).responseBody
  return typeof responseBody === "string" ? `${error.message}\n${responseBody}` : error.message
}

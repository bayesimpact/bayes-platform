import { isAxiosError } from "axios"

/**
 * Extracts a human-readable message from an API error so notifications can show what actually went
 * wrong instead of a generic fallback.
 *
 * NestJS error responses carry a `message` field — a plain string, or a `string[]` for
 * class-validator failures. Zod validation failures arrive as a single multi-line
 * `ZodValidationError: …` string built by the API's `ZodValidationPipe`; those are unwrapped into
 * concise `field: reason` lines. When nothing usable is found, the caller's `fallback` is returned.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const message = extractRawMessage(error)
  if (message === null) return fallback
  return humanizeZodValidationMessage(message)
}

function extractRawMessage(error: unknown): string | null {
  if (isAxiosError(error)) {
    const data = error.response?.data
    if (data && typeof data === "object" && "message" in data) {
      const { message } = data as { message: unknown }
      if (Array.isArray(message)) {
        const joined = message.filter((part): part is string => typeof part === "string").join("\n")
        if (joined.trim().length > 0) return joined
      }
      if (typeof message === "string" && message.trim().length > 0) return message
    }
  }
  if (error instanceof Error && error.message.trim().length > 0) return error.message
  return null
}

// Matches each issue the API's ZodValidationPipe emits: "[Issue N] <path>:\n <reason>".
const ZOD_ISSUE_PATTERN = /\[Issue \d+\]\s*(.+?):\s*\n\s*(.+)/g

function humanizeZodValidationMessage(message: string): string {
  if (!message.startsWith("ZodValidationError")) return message
  const issues = [...message.matchAll(ZOD_ISSUE_PATTERN)].map(
    ([, path, reason]) => `${path}: ${(reason ?? "").trim()}`,
  )
  return issues.length > 0 ? issues.join("\n") : message
}

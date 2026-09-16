import type { ToolSet } from "ai"

// biome-ignore lint/complexity/noStaticOnlyClass: helper
export class GemmaPromptHelper {
  /**
   * Gemma 4 emits ONE tool call per generation unless told otherwise: a
   * turn that needs a resource card AND a knowledge base lookup costs an
   * extra generation, and on some messages the second tool is simply
   * skipped. This line makes it group independent calls (measured 2026-09-16
   * on the vLLM deployment and through the platform pipeline: grouped on the
   * "charge" turn, card recovered on a French paid-leave question, neutral
   * on the English one). Gemma-only on purpose: the same line is neutral on
   * Gemini 3.6+ and DEGRADES Gemini 3.5 Flash Lite (drops the card), see
   * live-regressions/independent-tools-scenario.ts.
   *
   * POSITION-SENSITIVE: placed right after the null rule below, the line
   * stopped working on the French question (card skipped 5/5); placed
   * before it, both tools run 5/5. Keep it first, and re-measure with the
   * live suite before moving anything around it.
   */
  static readonly GROUPED_TOOL_CALLS_INSTRUCTION =
    "When several tools are needed and do not depend on each other's results, call them all in the SAME response instead of one per response."

  /**
   * Gemma calls tools natively through the OpenAI-compatible endpoint, so tool
   * definitions are NOT described in the prompt (unlike Mistral and MedGemma).
   * The prompt adjustments it needs: the instruction about nullable argument
   * fields, which Gemma otherwise fills with the string "null", and, when
   * more than one tool is declared, the grouped-calls instruction above.
   */
  static injectToolCallInstructions({ prompt, tools }: { prompt: string; tools: ToolSet }): string {
    // The instructions only concern tool calls, so they are pointless
    // without tools.
    const toolCount = Object.keys(tools ?? {}).length
    if (toolCount === 0) return prompt

    // FIXME: anchoring on a prompt substring is fragile — the instructions are
    // silently dropped if the master prompt stops emitting this exact heading.
    const marker = "## Response language:\nAlways answer in"
    const injections = [
      ...(toolCount > 1 ? [GemmaPromptHelper.GROUPED_TOOL_CALLS_INSTRUCTION] : []),
      `(CRITICAL) If a field value allows null, set the value to null when unknown. Set to null not to quoted "null"`,
    ]
    return prompt.includes(marker)
      ? prompt.replace(marker, `${injections.join("\n")}\n${marker}`)
      : prompt
  }

  /**
   * Kept because the MedGemma provider renders tool docs in-prompt and reuses
   * this — see ai-sdk-med-gemma.provider.ts. Not used for Gemma itself.
   */
  // biome-ignore lint/suspicious/noExplicitAny: custom
  static jsonSchemaToArgumentString(schema: any): string {
    if (!schema) return "unknown"

    if (schema.def) {
      return GemmaPromptHelper.jsonSchemaToArgumentString(schema.def)
    }

    if (schema.type === "nullable") {
      const inner = GemmaPromptHelper.jsonSchemaToArgumentString(schema.innerType)
      return `${inner} | null`
    }
    if (schema.type === "optional") {
      if (schema.innerType?.def?.type === "union") {
        const inner = GemmaPromptHelper.jsonSchemaToArgumentString(
          schema.innerType?.def?.options[0].def,
        )
        return `${inner} | null`
      }
      if (schema.innerType?.def) {
        const inner = GemmaPromptHelper.jsonSchemaToArgumentString(schema.innerType?.def)
        return `${inner} | null`
      }
    }
    if (schema.type === "default") {
      const defaultValue = schema.defaultValue
      const inner = GemmaPromptHelper.jsonSchemaToArgumentString(schema.innerType)
      return `${inner} (default: ${GemmaPromptHelper.formatDefault(defaultValue)})`
    }

    if (schema.type === "string") return "string"
    if (schema.type === "number") return "number"
    if (schema.type === "boolean") return "boolean"

    if (schema.type === "enum") {
      let values: unknown[] = []
      if (Array.isArray(schema.entries)) {
        values = schema.entries
      } else if (schema.entries && typeof schema.entries === "object") {
        values = Object.values(schema.entries)
      } else if (Array.isArray(schema.values)) {
        values = schema.values
      }
      if (values.length === 0) return "unknown"
      return values.map((v) => (typeof v === "string" ? `'${v}'` : String(v))).join(" | ")
    }

    if (schema.type === "array") {
      const inner = GemmaPromptHelper.jsonSchemaToArgumentString(schema.element)
      return /\s/.test(inner) ? `Array<${inner}>` : `${inner}[]`
    }

    // object with shape
    if (schema.type === "object" && schema.shape) {
      // biome-ignore lint/suspicious/noExplicitAny: custom
      const props = Object.entries(schema.shape).map(([key, value]: [string, any]) => {
        const typeStr = GemmaPromptHelper.jsonSchemaToArgumentString(value)
        return `${key}: ${typeStr}`
      })

      return `{ ${props.join("; ")} }`
    }

    return "unknown"
  }

  private static formatDefault<T>(value: T): string {
    if (typeof value === "string") {
      return `'${value.replace(/'/g, "\\'")}'`
    }
    return String(value)
  }
}

import type { ToolSet } from "ai"

// biome-ignore lint/complexity/noStaticOnlyClass: helper
export class GemmaPromptHelper {
  /**
   * Gemma calls tools natively through the OpenAI-compatible endpoint, so tool
   * definitions are NOT described in the prompt (unlike Mistral and MedGemma).
   * The only prompt adjustment it needs is this instruction about nullable
   * argument fields, which Gemma otherwise fills with the string "null".
   */
  static injectNullValueInstruction({ prompt, tools }: { prompt: string; tools: ToolSet }): string {
    // The instruction only concerns tool-call arguments, so it is pointless
    // without tools.
    if (Object.keys(tools ?? {}).length === 0) return prompt

    // FIXME: anchoring on a prompt substring is fragile — the instruction is
    // silently dropped if the master prompt stops emitting this exact heading.
    const marker = "## Response language:\nAlways answer in"
    const injection = `(CRITICAL) If a field value allows null, set the value to null when unknown. Set to null not to quoted "null"`
    return prompt.includes(marker) ? prompt.replace(marker, `${injection}\n${marker}`) : prompt
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

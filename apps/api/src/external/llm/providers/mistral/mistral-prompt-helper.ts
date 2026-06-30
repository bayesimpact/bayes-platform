import type { ToolSet } from "ai"

// biome-ignore lint/complexity/noStaticOnlyClass: helper
export class MistralPromptHelper {
  static appendToolsToPrompt({ prompt, tools }: { prompt: string; tools: ToolSet }): string {
    const toolDocs = MistralPromptHelper.convertToolsToDocs(tools)
    if (!toolDocs) return prompt
    return `${prompt}

##TOOLS
You have access to the following tools:
${toolDocs.join("\n")}

(CRITICAL) If a parameters allows null, set the value to null when unknown. Set to null not to quoted "null"`
  }
  static convertToolsToDocs(tools: ToolSet) {
    if (!tools || Object.entries(tools).length === 0) return undefined
    return Object.entries(tools).map(
      // biome-ignore lint/suspicious/noExplicitAny: custom unknown props
      ([name, tool]: any) =>
        `- ${name}: ${tool.description}\n  Parameters: ${MistralPromptHelper.jsonSchemaToArgumentString(tool.inputSchema)}`,
    )
  }
  // biome-ignore lint/suspicious/noExplicitAny: custom
  static jsonSchemaToArgumentString(schema: any): string {
    if (!schema) return "unknown"

    if (schema.def) {
      return MistralPromptHelper.jsonSchemaToArgumentString(schema.def)
    }

    if (schema.type === "nullable") {
      const inner = MistralPromptHelper.jsonSchemaToArgumentString(schema.innerType)
      return `${inner} | null`
    }
    if (schema.type === "optional") {
      if (schema.innerType?.def?.type === "union") {
        const inner = MistralPromptHelper.jsonSchemaToArgumentString(
          schema.innerType?.def?.options[0].def,
        )
        return `${inner} | null`
      }
      if (schema.innerType?.def) {
        const inner = MistralPromptHelper.jsonSchemaToArgumentString(schema.innerType?.def)
        return `${inner} | null`
      }
    }
    if (schema.type === "default") {
      const defaultValue = schema.defaultValue
      const inner = MistralPromptHelper.jsonSchemaToArgumentString(schema.innerType)
      return `${inner} (default: ${MistralPromptHelper.formatDefault(defaultValue)})`
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
      const inner = MistralPromptHelper.jsonSchemaToArgumentString(schema.element)
      return /\s/.test(inner) ? `Array<${inner}>` : `${inner}[]`
    }

    // object with shape
    if (schema.type === "object" && schema.shape) {
      // biome-ignore lint/suspicious/noExplicitAny: custom
      const props = Object.entries(schema.shape).map(([key, value]: [string, any]) => {
        const typeStr = MistralPromptHelper.jsonSchemaToArgumentString(value)
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

import type { ToolSet } from "ai"

// biome-ignore lint/complexity/noStaticOnlyClass: helper
export class GemmaPromptHelper {
  static appendToolsToPrompt({ prompt, tools }: { prompt: string; tools: ToolSet }): string {
    const toolDocs = GemmaPromptHelper.convertToolsToDocs(tools) ?? [].join("\n")
    return `${prompt}

##TOOLS
You have access to the following tools:
${toolDocs}

(CRITICAL) If a parameters allows null, set the value to null when unknown. Set to null not to quoted "null"`
  }
  static convertToolsToDocs(tools: ToolSet) {
    if (!tools) return undefined
    return Object.entries(tools).map(
      // biome-ignore lint/suspicious/noExplicitAny: custom unknown props
      ([name, tool]: any) =>
        `- ${name}: ${tool.description}\n  Parameters: ${GemmaPromptHelper.jsonSchemaToArgumentString(tool.inputSchema)}`,
    )
  }
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
    }

    if (schema.type === "string") return "string"
    if (schema.type === "number") return "number"
    if (schema.type === "boolean") return "boolean"

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
}

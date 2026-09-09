import {
  getOrderedPropertyEntries,
  outputJsonSchemaSchema,
  ToolName,
} from "@caseai-connect/api-contracts"
import { todaysDatePromptLine } from "@/common/utils/todays-date-prompt-line"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { lookupKnowledgeBaseInstruction } from "@/domains/agents/shared/agent-session-messages/streaming/tools/lookup-knowledge-base.tool"
import {
  enumerateAgentResources,
  type SurfaceableLibrary,
} from "@/domains/agents/shared/agent-session-messages/streaming/tools/surfaced-resources-registry"
import { mcpAppToolNamesFromDescriptions } from "@/external/mcp/mcp-app-tool-description"

export const promptHelpers = {
  now: () => todaysDatePromptLine(),

  resourceLibraries: (libraries: SurfaceableLibrary[]) => {
    // Aliases (r1, r2...) instead of real ids and links: the model only ever
    // cites an alias, the surfaceResources tool resolves it server-side. Real
    // links exposed here were getting RECITED into user-visible answers by
    // small models instead of triggering the tool call.
    const entries = enumerateAgentResources(libraries)
    if (entries.length === 0) return ""

    const byLibrary = new Map<SurfaceableLibrary, typeof entries>()
    for (const entry of entries) {
      const group = byLibrary.get(entry.library) ?? []
      group.push(entry)
      byLibrary.set(entry.library, group)
    }
    const serializedLibraries = [...byLibrary.entries()]
      .map(([library, libraryEntries]) => {
        const serializedResources = libraryEntries
          .map((entry) => {
            const matchingHintsLine = entry.resource.matchingHints
              ? `\n    matching hints (for matching only, do NOT show to the user): ${entry.resource.matchingHints}`
              : ""
            return `  - ${entry.alias}: ${entry.resource.title}\n    description: ${entry.resource.description}${matchingHintsLine}`
          })
          .join("\n")
        return `### ${library.title}\n${serializedResources}`
      })
      .join("\n\n")

    return `## Resource libraries:
You have access to the following resources. When the user's request matches a resource by its title, description, or matching hints, call the ${ToolName.SurfaceResources} tool with the ids (r1, r2, ...) of the matching resources. The tool shows them to the user as rich cards — never describe a resource's link in your text, and never copy the matching hints.

${serializedLibraries}`
  },

  language: (locale: string) =>
    `## Response language:
Always answer in ${locale === "en" ? "English" : locale === "fr" ? "French" : "user's language"}.
      `.trim(),

  mcpAppUis: (descriptions?: Record<string, string>) => {
    const toolNames = mcpAppToolNamesFromDescriptions(descriptions)
    if (toolNames.length === 0) return ""
    return `## Interactive tool UIs
These tools display an interactive UI in the chat when called: ${toolNames.join(", ")}. When the user asks to see, open, or display that UI, call the matching tool — even if you already have the data from an earlier turn. Never say you cannot display UI components or resource URIs. Do not recap, summarize, or restate the UI contents in markdown; the host already shows it.`
  },

  tools: ({
    agentSettings,
    names,
    descriptions = {},
  }: {
    names: string[]
    descriptions?: Record<string, string>
    agentSettings: AgentSettings
  }) => {
    if (names.length === 0) return ""
    return `## Tools:
${names
  .map((name) => {
    switch (name) {
      // Every declared tool is listed, this one included. The line POINTS
      // to the response protocol (the prompt epilogue) instead of repeating
      // it — the imperative lives there, in recency position.
      case ToolName.MandatoryTool:
        return `[${name}]: mandatory bookkeeping report (session categories, title, sources) attached to every response — see the "Response protocol" section at the end of this prompt.`

      case ToolName.LookupKnowledgeBase:
        return `[${name}]: ${lookupKnowledgeBaseInstruction()}`

      case ToolName.FillForm: {
        const parsedSchema = outputJsonSchemaSchema.safeParse(agentSettings.outputJsonSchema)
        const orderedFields = parsedSchema.success
          ? getOrderedPropertyEntries(parsedSchema.data)
          : []
        return `[${name}]: Use the ${name} tool to fill the form progressively. Call it with getFormState: true at any time — including alongside partial field updates — to retrieve the current form state and know which fields are already filled. Only pass fields that are new or have changed — never re-send fields already stored. Ask the user for any missing information until the form is complete. Ask the questions in the order listed below. To avoid overwhelming the user, ask one question at a time. However, keep in mind that a single answer may contain values for multiple form fields — be sure to capture every detail and save all of them in the form. From each user response, extract and fill as many fields as possible. Update any field whenever the user revises a previous answer. If a user response is unclear or doesn't map to any field, ask them to clarify or rephrase. Form fields:
${orderedFields
  .map(([key, value]) => {
    const hints: string[] = []
    if (value.enum && value.enum.length > 0) hints.push(`allowed values: ${value.enum.join(", ")}`)
    if (value.minimum !== undefined) hints.push(`minimum: ${value.minimum}`)
    if (value.maximum !== undefined) hints.push(`maximum: ${value.maximum}`)
    const hintSuffix = hints.length > 0 ? ` (${hints.join("; ")})` : ""
    return `- ${key}: ${value.description ?? "No description"}${hintSuffix}`
  })
  .join("\n")}\n\n`
      }

      case ToolName.McpSearchResources:
        return `[${name}]: Search for workforce and social resources from a specific source (datainclusion, francetravail-jobs, francetravail-events, francetravail-labonneboite). Returns raw results without AI processing. Use this when the user asks about a specific type of resource.`

      case ToolName.McpSmartSearch:
        return `[${name}]: AI-powered search across multiple workforce and social sources. Rewrites the query for better results and reranks by relevance. Use this when the user's question spans multiple resource types or when you want the best results across all sources.`

      case ToolName.SurfaceResources:
        return `[${name}]: Call ${name} tool whenever the user's request matches a resource in the resource libraries (by title or description or matchingHints). Pass the matching resources, copying their id, title, description, and link verbatim. Do not surface resources that are not relevant to the user's request.`

      default:
        if (descriptions[name]) return `[${name}]: ${descriptions[name]}`
        return `[${name}]: No specific instructions for this tool.`
    }
  })
  .join("\n")}`
  },
}

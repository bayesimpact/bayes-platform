import { ToolName } from "@caseai-connect/api-contracts"
import type { Agent } from "@/domains/agents/agent.entity"
import type { ResourceLibrary } from "@/domains/resource-libraries/resource-library.entity"
import { buildResourceLink } from "@/domains/resource-libraries/resource-library-link.helper"

export const promptHelpers = {
  now: () => `Today's date: ${new Date().toLocaleDateString()}`,

  resourceLibraries: (libraries: ResourceLibrary[]) => {
    const librariesWithResources = libraries.filter(
      (library) => (library.resources?.length ?? 0) > 0,
    )
    if (librariesWithResources.length === 0) return ""

    const serializedLibraries = librariesWithResources
      .map((library) => {
        const serializedResources = library.resources
          .map((resource) => {
            const link = buildResourceLink({
              resource,
              organizationId: library.organizationId,
              projectId: library.projectId,
              resourceLibraryId: library.id,
            })
            const matchingHintsLine = resource.matchingHints
              ? `\n    matching hints (for matching only, do NOT show to the user): ${resource.matchingHints}`
              : ""
            return `  - id: ${resource.id}\n    title: ${resource.title}\n    description: ${resource.description}${matchingHintsLine}\n    link: ${link}`
          })
          .join("\n")
        return `### ${library.title}\n${serializedResources}`
      })
      .join("\n\n")

    return `## Resource libraries:
You have access to the following resources. When the user's request matches a resource by its title, description, or matching hints, call the ${ToolName.SurfaceResources} tool with the matching resources (copy their id, title, description, and link verbatim — never copy the matching hints). Do not invent resources or links.

${serializedLibraries}`
  },

  language: (locale: string) =>
    `## Response language:
Always answer in ${locale === "en" ? "English" : locale === "fr" ? "French" : "user's language"}.
      `.trim(),

  tools: ({
    agent,
    names,
    descriptions = {},
  }: {
    names: string[]
    descriptions?: Record<string, string>
    agent: Agent
  }) =>
    names.length === 0
      ? ""
      : `## Tools:
${names
  .map((name) => {
    switch (name) {
      case ToolName.RetrieveProjectDocumentChunks:
        return `[${name}]: When the user asks about information that may exist in project documents, call the ${name} tool before answering. Use the returned chunks as primary context and avoid inventing facts not present in those chunks.`

      case ToolName.Sources:
        return `[${name}]: You MUST call the ${name} tool whenever you use information from the ${ToolName.RetrieveProjectDocumentChunks} tool to answer the user, regardless of whether the chunks come from uploaded documents (documentSourceType="project") or crawled web pages (documentSourceType="webCrawl"). Include EVERY document whose chunks you actually used — do not omit web-crawled pages. For each source, copy the documentId, documentTitle, and documentSourceType verbatim from the retrieved chunks. Do NOT cite sources inline in your text response; the ${name} tool is the only way to show sources to the user.`

      case ToolName.FillForm:
        return `[${name}]: Use the ${name} tool to fill the form progressively. Call it with getFormState: true at any time — including alongside partial field updates — to retrieve the current form state and know which fields are already filled. Only pass fields that are new or have changed — never re-send fields already stored. Ask the user for any missing information until the form is complete. Form fields:
${Object.entries(agent.outputJsonSchema?.properties ?? {})
  .map(
    ([key, value]) => `- ${key}: ${"description" in value ? value.description : "No description"}`,
  )
  .join("\n")}\n\n`

      case ToolName.RecalculateConversationSessionMetadata:
        return `[${name}]: Call this tool after answering the user so session metadata stays aligned. Return the full category set that should remain on the session (including categories still relevant from earlier turns), not only categories from the latest message.`

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
  .join("\n")}`,
}

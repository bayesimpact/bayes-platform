import { ToolName } from "@caseai-connect/api-contracts"

export const promptHelpers = {
  now: () => `Today's date: ${new Date().toLocaleDateString()}`,

  language: (locale: string) =>
    `## Response language:
Always answer in ${locale === "en" ? "English" : locale === "fr" ? "French" : "user's language"}.
      `.trim(),

  tools: (names: ToolName[]) =>
    names.length === 0
      ? ""
      : `## Tools:
${names
  .map((name) => {
    switch (name) {
      case ToolName.RetrieveProjectDocumentChunks:
        return `[${name}]: When the user asks about information that may exist in project documents, call the ${name} tool before answering. Use the returned chunks as primary context and avoid inventing facts not present in those chunks.`

      case ToolName.Sources:
        return `[${name}]: After using ${ToolName.RetrieveProjectDocumentChunks} tool, call the ${name} tool to provide the user with the sources of the information you used to answer their question. This will help build trust and allow the user to verify the information.`

      case ToolName.FillForm:
        return `[${name}]: You can use the ${name} tool to fill out the form fields. Just fill out the information you have and ask the user for the missing information. You can also update previously filled information if the user changes their answer. Pass undefined for fields that are not filled yet.`

      case ToolName.RecalculateConversationSessionMetadata:
        return `[${name}]: Call this tool after answering the user so session metadata stays aligned. Return the full category set that should remain on the session (including categories still relevant from earlier turns), not only categories from the latest message.`

      case ToolName.McpSearchResources:
        return `[${name}]: Search for workforce and social resources from a specific source (datainclusion, francetravail-jobs, francetravail-events, francetravail-labonneboite). Returns raw results without AI processing. Use this when the user asks about a specific type of resource.`

      case ToolName.McpSmartSearch:
        return `[${name}]: AI-powered search across multiple workforce and social sources. Rewrites the query for better results and reranks by relevance. Use this when the user's question spans multiple resource types or when you want the best results across all sources.`

      default:
        return `[${name}]: No specific instructions for this tool.`
    }
  })
  .join("\n")}`,
}

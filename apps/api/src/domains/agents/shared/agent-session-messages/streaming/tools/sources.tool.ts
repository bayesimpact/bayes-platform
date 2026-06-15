import { ToolName } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import type { ToolExecutionLog } from "./tool-execution-log"

export function sourcesTool({
  onExecute,
  resolvePublicDocumentIds,
}: {
  onExecute: (toolExecution: ToolExecutionLog) => void
  resolvePublicDocumentIds: (documentIds: string[]) => Promise<Set<string>>
}) {
  return tool({
    description: "Retrieve sources from document chunks that you use to answer questions.",
    inputSchema: z.object({
      sources: z.array(
        z.object({
          documentId: z.string().describe("The ID of the document to retrieve sources from."),
          documentTitle: z
            .string()
            .optional()
            .describe("The title of the source document (copy from retrieved chunks)."),
          documentSourceType: z
            .string()
            .optional()
            .describe(
              "The source type of the document, e.g. 'project' for an uploaded file or 'webCrawl' for a crawled web page (copy from retrieved chunks).",
            ),
          chunks: z
            .array(
              z.object({
                chunkId: z
                  .string()
                  .describe("The ID of the document chunk to retrieve sources from."),
                partialContent: z
                  .string()
                  .describe(
                    "The partial content of the document chunk that you used to answer the question.",
                  ),
              }),
            )
            .describe("The document chunks that you used to answer the question."),
        }),
      ),
    }),
    outputSchema: z.object({
      role: z.literal("system"),
      content: z.string().describe("The content of the system message."),
    }),
    execute: async (input, _options) => {
      // Resolve the public status server-side from the document tags rather than
      // trusting the LLM. This drives the download affordance in chat, so it must
      // be authoritative.
      const publicDocumentIds = await resolvePublicDocumentIds(
        input.sources.map((source) => source.documentId),
      )
      const resolvedInput = {
        sources: input.sources.map((source) => ({
          ...source,
          isPublicDocument: publicDocumentIds.has(source.documentId),
        })),
      }
      onExecute({ toolName: ToolName.Sources, arguments: resolvedInput })
      return {
        role: "system",
        content:
          "Sources received. Say nothing in response to the user. This tool is only for logging purposes.",
      }
    },
  })
}

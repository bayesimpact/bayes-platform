import { ToolName } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { DocumentChunkRetrievalService } from "@/domains/documents/embeddings/document-chunk-retrieval.service"
import type { ToolExecutionLog } from "./tool-execution-log"

export const DEFAULT_TOP_K = 20

const retrieveProjectDocumentChunksInputSchema = z.object({
  conversationSummary: z
    .string()
    .default("")
    .describe("Short summary of the conversation so far, including relevant context."),
  latestUserQuestion: z
    .string()
    .min(1)
    .describe("The latest user question that must be answered with project documents."),
  topK: z
    .number()
    .int()
    .positive()
    .max(DEFAULT_TOP_K)
    .default(DEFAULT_TOP_K)
    .describe(`How many chunks to return. Default is ${DEFAULT_TOP_K}.`),
})

const retrievedChunkSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  documentTitle: z.string(),
  documentFileName: z.string().nullable(),
  chunkIndex: z.number().int(),
  content: z.string(),
  distance: z.number(),
  modelName: z.string(),
  isParentChunk: z.boolean(),
})

export type RetrieveProjectDocumentChunksExecution = {
  input: z.infer<typeof retrieveProjectDocumentChunksInputSchema>
  result: {
    chunkIds: string[]
    documentIds: string[]
    documentTagIds: string[]
    returnedChunkCount: number
    topK: number
  }
}

export function buildRetrieveProjectDocumentChunksToolExecutionLog(
  execution: RetrieveProjectDocumentChunksExecution,
): ToolExecutionLog {
  return {
    toolName: ToolName.RetrieveProjectDocumentChunks,
    arguments: {
      conversationSummary: execution.input.conversationSummary,
      latestUserQuestion: execution.input.latestUserQuestion,
      topK: execution.input.topK,
      documentTagIds: execution.result.documentTagIds,
      returnedChunkCount: execution.result.returnedChunkCount,
      chunkIds: execution.result.chunkIds,
      documentIds: execution.result.documentIds,
    },
  }
}

export function retrieveProjectDocumentChunksTool({
  connectScope,
  documentTagIds = [],
  retrievalService,
  onExecute,
}: {
  connectScope: RequiredConnectScope
  documentTagIds?: string[]
  retrievalService: DocumentChunkRetrievalService
  onExecute: (toolExecution: ToolExecutionLog) => void
}) {
  return tool({
    description:
      "Retrieve the most relevant project document chunks for the current conversation context and latest user question.",
    inputSchema: retrieveProjectDocumentChunksInputSchema,
    outputSchema: z.object({
      retrievedChunks: z.array(retrievedChunkSchema),
      retrievalMetadata: z.object({
        returnedChunkCount: z.number().int(),
        topK: z.number().int(),
      }),
    }),
    execute: async (input) => {
      const retrievedChunks = await retrievalService.retrieveTopChunks({
        connectScope,
        conversationSummary: input.conversationSummary,
        latestUserQuestion: input.latestUserQuestion,
        topK: input.topK,
        documentTagIds,
      })
      const documentIds = [...new Set(retrievedChunks.map((chunk) => chunk.documentId))]
      onExecute(
        buildRetrieveProjectDocumentChunksToolExecutionLog({
          input,
          result: {
            chunkIds: retrievedChunks.map((chunk) => chunk.chunkId),
            documentIds,
            documentTagIds,
            returnedChunkCount: retrievedChunks.length,
            topK: input.topK,
          },
        }),
      )
      return {
        retrievedChunks,
        retrievalMetadata: {
          returnedChunkCount: retrievedChunks.length,
          topK: input.topK,
        },
      }
    },
  })
}

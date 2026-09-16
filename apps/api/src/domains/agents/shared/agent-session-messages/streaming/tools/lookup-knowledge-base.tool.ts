import { ToolName } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { DocumentChunkRetrievalService } from "@/domains/documents/embeddings/document-chunk-retrieval.service"
import type { RetrievedChunksRegistry } from "./retrieved-chunks-registry"
import type { ToolExecutionLog } from "./tool-execution-log"

export const DEFAULT_TOP_K = 20

/**
 * Wording is tuned for small open-weight models (Gemma class), which under-call
 * retrieval tools whenever the decision to call is left to them as a judgement.
 *
 * The framing is deliberately epistemic rather than topical: users never ask
 * "about documents", they just ask questions, and the model has no way to
 * recognise a question as document-shaped. So the description does not describe
 * what the knowledge base holds — it tells the model that the knowledge base is
 * absent from its training data and that it therefore does not know the answer.
 * That turns "should I call this?" into a default ("assume you do not know")
 * with a short, closed list of exceptions, which is a decision a small model
 * makes reliably.
 */
export const LOOKUP_KNOWLEDGE_BASE_DESCRIPTION = [
  "Look up this assistant's knowledge base and return the passages that answer a question.",
  "The knowledge base holds information that is not in your training data. You have never seen it and cannot know what it says — so you do not know the answer to the user's question, even when it feels familiar.",
  "Assume you do not know. Call this tool before replying, and answer only from the passages it returns.",
  "The only exceptions are greetings, thanks and goodbyes, and questions about what was already said in this conversation.",
].join("\n")

/**
 * Master-prompt instruction for the lookup tool. Complements the tool
 * description: the description carries the epistemic call-decision framing,
 * this instruction adds the usage rules (standalone rewriting, answer only
 * from passages). Exported so the live regression scenarios use the exact
 * production wording instead of drifting hand-written copies.
 */
export function lookupKnowledgeBaseInstruction(): string {
  return `The knowledge base holds information that is not in your training data, so you do not know the answer to the user's question — assume you must look it up. Call the ${ToolName.LookupKnowledgeBase} tool BEFORE replying to anything except greetings and questions about what was already said in this conversation, including follow-up questions and questions that feel familiar. Rewrite the question as a standalone sentence before passing it. Answer only from the returned passages; if they do not contain the answer, say so instead of inventing one.`
}

/**
 * Inline citation rule, appended to the lookup tool (description and master
 * prompt line) only when the project reports sources: the model marks each
 * sentence that relies on a passage with the passage alias, and the server
 * turns the markers into source cards (see inline-citations.ts). Without
 * this rule the aliases are still shown to the model, but nothing asks it to
 * cite them.
 */
export function inlineCitationInstruction(): string {
  return "Cite your sources inline: right after each sentence that relies on a retrieved passage, write the passage id in square brackets, copied exactly from the lookup results, e.g. [c1] or [c1, c3]. Never invent an id and never cite in any other form; the ids are turned into source cards for the user."
}

const lookupKnowledgeBaseInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'The question to look up, rewritten as a standalone sentence that makes sense on its own. Resolve pronouns and shorthand ("it", "that one", "and for last year?") from the conversation.',
    ),
})

/**
 * The model-visible shape of a retrieved chunk: a short alias id (c1, c2, ...)
 * plus only what the model actually uses to answer. UUIDs, distances, file
 * names, etc. stay server-side (in the retrieved-chunks registry) — they cost
 * hundreds of prompt tokens per turn and small models mangle UUIDs when
 * asked to copy them back.
 */
const retrievedChunkSchema = z.object({
  id: z.string().describe("Short chunk id (c1, c2, ...) — cite it inline as [c1]."),
  documentTitle: z.string(),
  content: z.string(),
})

export type LookupKnowledgeBaseExecution = {
  input: z.infer<typeof lookupKnowledgeBaseInputSchema>
  result: {
    chunkIds: string[]
    documentIds: string[]
    documentTagIds: string[]
    returnedChunkCount: number
    topK: number
  }
}

export function buildLookupKnowledgeBaseToolExecutionLog(
  execution: LookupKnowledgeBaseExecution,
): ToolExecutionLog {
  return {
    toolName: ToolName.LookupKnowledgeBase,
    arguments: {
      query: execution.input.query,
      topK: DEFAULT_TOP_K,
      documentTagIds: execution.result.documentTagIds,
      returnedChunkCount: execution.result.returnedChunkCount,
      chunkIds: execution.result.chunkIds,
      documentIds: execution.result.documentIds,
    },
  }
}

export function lookupKnowledgeBaseTool({
  connectScope,
  documentTagIds = [],
  retrievalService,
  retrievedChunksRegistry,
  citeInline = false,
  onExecute,
}: {
  connectScope: RequiredConnectScope
  documentTagIds?: string[]
  retrievalService: DocumentChunkRetrievalService
  retrievedChunksRegistry?: RetrievedChunksRegistry
  /** Adds the inline citation rule to the description (sources reporting on). */
  citeInline?: boolean
  onExecute: (toolExecution: ToolExecutionLog) => void | Promise<void>
}) {
  return tool({
    description: citeInline
      ? `${LOOKUP_KNOWLEDGE_BASE_DESCRIPTION}\n${inlineCitationInstruction()}`
      : LOOKUP_KNOWLEDGE_BASE_DESCRIPTION,
    inputSchema: lookupKnowledgeBaseInputSchema,
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
        query: input.query,
        topK: DEFAULT_TOP_K,
        documentTagIds,
      })
      const modelVisibleChunks = retrievedChunks.map((chunk) => ({
        id: retrievedChunksRegistry?.register(chunk) ?? chunk.chunkId,
        documentTitle: chunk.documentTitle,
        content: chunk.content,
      }))
      const documentIds = [...new Set(retrievedChunks.map((chunk) => chunk.documentId))]
      await onExecute(
        buildLookupKnowledgeBaseToolExecutionLog({
          input,
          result: {
            chunkIds: retrievedChunks.map((chunk) => chunk.chunkId),
            documentIds,
            documentTagIds,
            returnedChunkCount: retrievedChunks.length,
            topK: DEFAULT_TOP_K,
          },
        }),
      )
      return {
        retrievedChunks: modelVisibleChunks,
        retrievalMetadata: {
          returnedChunkCount: retrievedChunks.length,
          topK: DEFAULT_TOP_K,
        },
      }
    },
  })
}

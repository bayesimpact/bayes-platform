import type { RetrievedDocumentChunk } from "@/domains/documents/embeddings/document-chunk.types"

/**
 * Per-request registry of the chunks returned by lookup_knowledge_base.
 *
 * Each registered chunk gets a short sequential alias (c1, c2, ...) — the
 * ONLY id the model ever sees. UUIDs are unreliable for small models to copy
 * (a single dropped character silently loses the source) and cost ~15 tokens
 * each; a 2-character alias is practically un-manglable. The model cites an
 * alias inline (`[c1]`, see inline-citations.ts) and the server resolves it
 * back to the real chunk, so persisted sources keep their real UUIDs.
 *
 * Purely in-memory and request-scoped: built once per streaming turn in
 * ToolsService and garbage-collected with it. Aliases restart at c1 on every
 * turn, which is safe because previous turns' tool results are never part of
 * the LLM-visible history (see llm-visible-message.helper.ts). If past
 * retrievals ever get injected into the history, aliases from different
 * turns would collide — the mapping would then need a per-turn prefix or
 * session persistence.
 */
export type RetrievedChunksRegistry = {
  /** Registers a chunk and returns its model-facing alias (c1, c2, ...). */
  register(chunk: RetrievedDocumentChunk): string
  /** Resolves a model-cited alias (case/whitespace tolerant). */
  get(alias: string): RetrievedDocumentChunk | undefined
  /** True once at least one lookup registered chunks in this turn. */
  hasChunks(): boolean
  /** Every registered chunk with its alias, in registration order. */
  entries(): Array<{ alias: string; chunk: RetrievedDocumentChunk }>
}

export function createRetrievedChunksRegistry(): RetrievedChunksRegistry {
  const chunksByAlias = new Map<string, RetrievedDocumentChunk>()
  return {
    register(chunk) {
      const alias = `c${chunksByAlias.size + 1}`
      chunksByAlias.set(alias, chunk)
      return alias
    },
    get(alias) {
      return chunksByAlias.get(alias.trim().toLowerCase())
    },
    hasChunks() {
      return chunksByAlias.size > 0
    },
    entries() {
      return [...chunksByAlias.entries()].map(([alias, chunk]) => ({ alias, chunk }))
    },
  }
}

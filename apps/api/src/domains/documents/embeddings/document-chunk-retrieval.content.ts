import type { RetrievedDocumentChunk } from "./document-chunk.types"

const PASSAGE_SEPARATOR = "\n\n"

/**
 * One row of the retrieval query. `content` is the section (the parent chunk) when it fits the
 * limit, and the matching passage otherwise. In that last case the row also carries the passages
 * just before and after it in the same section.
 */
export type RetrievedChunkRow = RetrievedDocumentChunk & {
  hasOversizedParent: boolean
  childParentId: string | null
  previousChunkId: string | null
  previousContent: string | null
  nextChunkId: string | null
  nextContent: string | null
}

/**
 * Decides the text the model gets for each hit, best hit first, never above `maxChunkCharacters`:
 * the section when it fits, else the passage with its neighbours, else the passage alone.
 * A neighbour already returned in this lookup, as a hit or beside one, is not repeated.
 */
export function toRetrievedChunks({
  rows,
  maxChunkCharacters,
}: {
  rows: RetrievedChunkRow[]
  maxChunkCharacters: number
}): RetrievedDocumentChunk[] {
  const returnedChunkIds = new Set(rows.map((row) => row.chunkId))

  return rows.map((row) => {
    const {
      hasOversizedParent,
      childParentId: _childParentId,
      previousChunkId,
      previousContent,
      nextChunkId,
      nextContent,
      ...chunk
    } = row

    let content = chunk.content
    if (hasOversizedParent) {
      const neighbours = [
        { chunkId: previousChunkId, content: previousContent, isBefore: true },
        { chunkId: nextChunkId, content: nextContent, isBefore: false },
      ]
      for (const neighbour of neighbours) {
        if (!neighbour.chunkId || !neighbour.content || returnedChunkIds.has(neighbour.chunkId)) {
          continue
        }
        const widenedContent = neighbour.isBefore
          ? `${neighbour.content}${PASSAGE_SEPARATOR}${content}`
          : `${content}${PASSAGE_SEPARATOR}${neighbour.content}`
        if (widenedContent.length > maxChunkCharacters) {
          continue
        }
        content = widenedContent
        returnedChunkIds.add(neighbour.chunkId)
      }
    }

    return {
      ...chunk,
      content: content.slice(0, maxChunkCharacters),
      isParentChunk: Boolean(chunk.isParentChunk),
    }
  })
}

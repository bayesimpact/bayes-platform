export type DoclingChunk = {
  chunk_id: string
  embed_text: string
  text: string
  parent_id: string | null
  prev_chunk_id: string | null
  next_chunk_id: string | null
  headings: string[]
  captions: string[]
  metadata: Record<string, unknown>
}

export type DoclingParentChunk = {
  chunk_id: string
  embed_text: string
  text: string
  prev_chunk_id: string | null
  next_chunk_id: string | null
  headings: string[]
  captions: string[]
}

export type DoclingOutput = {
  child_chunks: DoclingChunk[]
  parent_chunks: DoclingParentChunk[]
}

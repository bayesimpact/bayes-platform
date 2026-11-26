import type { DocumentTagDto, DocumentTagsUpdateFieldsDto } from "@bayes-platform/api-contracts"

export type DocumentTag = DocumentTagDto

export type DocumentTagsUpdateFields = DocumentTagsUpdateFieldsDto

export type TagNode = DocumentTag & { children: TagNode[] }

export function buildTagTree(tags: DocumentTag[]): TagNode[] {
  const tagMap = new Map<string, TagNode>()
  for (const tag of tags) {
    tagMap.set(tag.id, { ...tag, children: [] })
  }
  const roots: TagNode[] = []
  for (const node of tagMap.values()) {
    if (node.parentId === undefined) {
      roots.push(node)
    } else {
      const parent = tagMap.get(node.parentId)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
  }
  return roots
}

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@caseai-connect/ui/shad/collapsible"
import { ChevronRight } from "lucide-react"
import { Grid, GridContent } from "@/common/components/grid/Grid"
import type { DocumentTag, TagNode } from "@/studio/features/document-tags/document-tags.models"
import type { Document } from "@/studio/features/documents/documents.models"
import { DocumentItem } from "./DocumentItem"

export function DocumentTagTreeNode({
  tag,
  documents,
  depth,
  documentTags,
}: {
  documentTags: DocumentTag[]
  tag: TagNode
  documents: Document[]
  depth: number
}) {
  const tagDocuments = documents.filter((document) => document.tagIds.some((id) => id === tag.id))
  const hasContent = tagDocuments.length > 0 || tag.children.length > 0

  if (!hasContent) return null

  return (
    <Collapsible defaultOpen className="border border-gray-200 p-6 col-span-full">
      <CollapsibleTrigger
        className="flex items-center gap-1 text-lg font-medium hover:text-foreground w-full py-1 [&[data-state=open]>svg]:rotate-90"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
      >
        <ChevronRight className="size-4 transition-transform" />
        {tag.name}

        <span className="ml-1 text-xs text-muted-foreground">({tagDocuments.length})</span>
      </CollapsibleTrigger>
      <CollapsibleContent
        className="flex flex-col gap-3 pt-2"
        style={{ paddingLeft: `${(depth + 1) * 1.25}rem` }}
      >
        <Grid cols={3}>
          <GridContent>
            {tagDocuments.map((document) => (
              <DocumentItem key={document.id} document={document} documentTags={documentTags} />
            ))}
            {tag.children.map((child) => (
              <DocumentTagTreeNode
                key={child.id}
                tag={child}
                documents={documents}
                depth={depth + 1}
                documentTags={documentTags}
              />
            ))}
          </GridContent>
        </Grid>
      </CollapsibleContent>
    </Collapsible>
  )
}

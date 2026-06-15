import { PUBLIC_DOCUMENTS_TAG_NAME } from "@caseai-connect/api-contracts"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@caseai-connect/ui/shad/breadcrumb"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemHeader,
  ItemTitle,
} from "@caseai-connect/ui/shad/item"
import { TagIcon } from "lucide-react"
import { useAppSelector } from "@/common/store/hooks"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { selectDocumentTagsData } from "@/studio/features/document-tags/document-tags.selectors"
import { DocumentTagDeletor } from "./DocumentTagDeletor"
import { DocumentTagEditor } from "./DocumentTagEditor"

export function DocumentTagItem({
  tag,
  readonly = false,
}: {
  tag: DocumentTag
  readonly?: boolean
}) {
  const allTags = useAppSelector(selectDocumentTagsData)
  const parentTag = tag.parentId
    ? (allTags.value?.find((t) => t.id === tag.parentId) ?? null)
    : null
  return (
    <Item variant="outline" className="w-full">
      <ItemHeader>
        <ItemTitle>
          <TagIcon className="size-4 shrink-0" />
          <Breadcrumb>
            <BreadcrumbList>
              {parentTag && (
                <>
                  <BreadcrumbItem>
                    <span>{parentTag.name}</span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>{tag.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </ItemTitle>
        {!readonly && tag.name !== PUBLIC_DOCUMENTS_TAG_NAME && (
          <ItemActions>
            {allTags.value && <DocumentTagEditor allTags={allTags.value} tag={tag} />}
            <DocumentTagDeletor tag={tag} />
          </ItemActions>
        )}
      </ItemHeader>
      {tag.description && (
        <ItemContent>
          <ItemDescription className="whitespace-break-spaces">{tag.description}</ItemDescription>
        </ItemContent>
      )}
    </Item>
  )
}

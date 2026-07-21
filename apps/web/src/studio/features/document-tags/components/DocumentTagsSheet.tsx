import { Button } from "@caseai-connect/ui/shad/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@caseai-connect/ui/shad/collapsible"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@caseai-connect/ui/shad/sheet"
import { ChevronRight, TagsIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { buildTagTree, type TagNode } from "@/studio/features/document-tags/document-tags.models"
import { DocumentTagCreator } from "./DocumentTagCreator"
import { DocumentTagItem } from "./DocumentTagItem"

export function DocumentTagsSheet({ documentTags }: { documentTags: DocumentTag[] }) {
  const { t } = useTranslation("documentTag")
  const tagTree = buildTagTree(documentTags)
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <TagsIcon className="size-4" />
          {t("sheet.button")}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("sheet.title")}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
          <div className="flex justify-end">
            <DocumentTagCreator allTags={documentTags} />
          </div>
          {documentTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("sheet.empty")}</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {tagTree.map((tag) => (
                <DocumentTagSheetNode key={tag.id} tag={tag} allTags={documentTags} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DocumentTagSheetNode({ tag, allTags }: { tag: TagNode; allTags: DocumentTag[] }) {
  if (tag.children.length === 0) {
    return <DocumentTagItem tag={tag} />
  }
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium hover:text-foreground w-full py-1 [&[data-state=open]>svg]:rotate-90">
        <ChevronRight className="size-4 transition-transform" />
        {tag.name}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 pl-4 pt-1">
        <DocumentTagItem tag={tag} />
        {tag.children.map((child) => (
          <DocumentTagSheetNode key={child.id} tag={child} allTags={allTags} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { PencilIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { updateDocumentTag } from "@/studio/features/document-tags/document-tags.thunks"
import { DocumentTagForm } from "./DocumentTagForm"

export function DocumentTagEditor({ allTags, tag }: { allTags: DocumentTag[]; tag: DocumentTag }) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation("documentTag", { keyPrefix: "edit" })
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { tagName: tag.name })}</DialogTitle>
        </DialogHeader>

        <DocumentTagForm
          allTags={allTags}
          editableTag={tag}
          onSubmit={(fields) => {
            dispatch(
              updateDocumentTag({ documentTagId: tag.id, fields, onSuccess: () => setOpen(false) }),
            )
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

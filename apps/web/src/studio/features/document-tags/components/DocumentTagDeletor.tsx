import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { deleteDocumentTag } from "@/studio/features/document-tags/document-tags.thunks"

export function DocumentTagDeletor({ tag }: { tag: DocumentTag }) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const handleDelete = () => {
    dispatch(deleteDocumentTag({ documentTagId: tag.id, onSuccess: () => setOpen(false) }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Trash2Icon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("documentTag:delete.title", { tagName: tag.name })}</DialogTitle>
          <DialogDescription>{t("documentTag:delete.description")}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("actions:cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            {t("actions:confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import type { Document } from "@/studio/features/documents/documents.models"
import { deleteDocument } from "@/studio/features/documents/documents.thunks"

export function DocumentDeletor({ document }: { document: Document }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const [open, setOpen] = useState(false)

  const handleSuccess = () => {
    setOpen(false)
  }

  const handleDelete = () => {
    dispatch(deleteDocument({ documentId: document.id, onSuccess: handleSuccess }))
  }

  const handleClose = () => {
    setOpen(false)
  }

  if (!document) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Trash2Icon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("document:delete.title", { documentTitle: document.title })}</DialogTitle>
          <DialogDescription className="wrap-anywhere">
            {t("document:delete.description", { name: document.title })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            {t("actions:cancel")}
          </Button>

          <Button variant="destructive" onClick={handleDelete}>
            {t("actions:delete")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

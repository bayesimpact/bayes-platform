import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { createDocumentTag } from "@/studio/features/document-tags/document-tags.thunks"
import { DocumentTagForm } from "./DocumentTagForm"

export function DocumentTagCreator({ allTags }: { allTags: DocumentTag[] }) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation("documentTag", { keyPrefix: "create" })
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <DocumentTagForm
          allTags={allTags}
          onSubmit={(fields) => {
            dispatch(createDocumentTag({ fields, onSuccess: () => setOpen(false) }))
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

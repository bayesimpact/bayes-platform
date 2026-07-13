import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { useTranslation } from "react-i18next"

type Props = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  confirmIcon?: React.ReactNode
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmIcon,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("actions:cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {confirmIcon} {confirmLabel ?? t("actions:delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

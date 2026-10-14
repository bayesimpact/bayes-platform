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
  /** Destructive by default, for deletions. Use `default` for a change that is not one. */
  confirmVariant?: "destructive" | "default"
  onConfirm: () => void
  onCancel: () => void
  /** Shown in the dialog when the confirmed action failed, so the person sees it where they clicked. */
  error?: string | null
  /** Disables the buttons while the confirmed action runs. */
  isConfirming?: boolean
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmIcon,
  confirmVariant = "destructive",
  onConfirm,
  onCancel,
  error,
  isConfirming = false,
}: Props) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isConfirming}>
            {t("actions:cancel")}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {confirmIcon} {confirmLabel ?? t("actions:delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

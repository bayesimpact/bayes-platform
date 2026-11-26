import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@caseai-connect/app-ui/components/alert-dialog"
import { Button } from "@caseai-connect/app-ui/components/button"
import { Trans } from "@lingui/react/macro"
import type { ReactNode } from "react"

export type ConfirmDialogProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  title: ReactNode
  description: ReactNode
  /** The text of the button that confirms. */
  confirmLabel: ReactNode
  /** The text of the button that gives up, when Cancel would read as the action itself. */
  dismissLabel?: ReactNode
  /** Whether confirming removes something for good: the button then warns. */
  isDestructive?: boolean
  /** While the action runs, the button waits. */
  isPending: boolean
  onConfirm: () => void
}

/** Asks the person to confirm an action they cannot take back, before it runs. */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  dismissLabel,
  isDestructive = false,
  isPending,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{dismissLabel ?? <Trans>Cancel</Trans>}</AlertDialogCancel>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            disabled={isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

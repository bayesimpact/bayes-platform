import { Trans, useLingui } from "@lingui/react/macro"
import { toast } from "sonner"
import { ConfirmDialog } from "./ConfirmDialog"
import type { MutationLike } from "./mutation-like"

export type DeleteRunDialogProps = {
  /** The id of the run to delete, or `null` while the dialog is closed. */
  runId: string | null
  onClose: () => void
  /** Deletes a run, by its id. */
  deleteRun: MutationLike<string>
  /** Called once the run is deleted, for a page that showed it to leave. */
  onDeleted?: () => void
}

/** Asks before a run and its results are deleted for good, then says how it went. */
export function DeleteRunDialog({ runId, onClose, deleteRun, onDeleted }: DeleteRunDialogProps) {
  const { t } = useLingui()
  return (
    <ConfirmDialog
      isOpen={runId !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
      title={<Trans>Delete this run?</Trans>}
      description={<Trans>The run and its results are deleted for good.</Trans>}
      confirmLabel={<Trans>Delete</Trans>}
      isDestructive
      isPending={deleteRun.isPending}
      onConfirm={() => {
        if (runId === null) return
        deleteRun.mutate(runId, {
          onSuccess: () => {
            toast.success(t`The run was deleted.`)
            onClose()
            onDeleted?.()
          },
          onError: () => toast.error(t`The run could not be deleted. Try again.`),
        })
      }}
    />
  )
}

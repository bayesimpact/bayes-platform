import { Trans } from "@lingui/react/macro"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { type DeletedEntry, useDeleteHistoryEntry } from "../api/mutations"
import type { HistoryAgent } from "../history-entries"

export type DeleteEntryDialogProps = {
  agent: Omit<HistoryAgent, "type">
  entry: DeletedEntry
  /** The entry's name, as the page or the history shows it. */
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

/** Asks before deleting a conversation or an extraction, which cannot come back. */
export function DeleteEntryDialog({
  agent,
  entry,
  title,
  open,
  onOpenChange,
  onDeleted,
}: DeleteEntryDialogProps) {
  const deleteEntry = useDeleteHistoryEntry(agent)
  const isConversation = entry.kind === "conversation"

  const handleDelete = () =>
    deleteEntry.mutate(entry, {
      onSuccess: () => {
        onOpenChange(false)
        onDeleted()
      },
    })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isConversation ? (
              <Trans>Delete this conversation?</Trans>
            ) : (
              <Trans>Delete this extraction?</Trans>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isConversation ? (
              <Trans>"{title}" and its messages will be deleted. This cannot be undone.</Trans>
            ) : (
              <Trans>
                The extraction of "{title}" and its results will be deleted. The document stays in
                your documents. This cannot be undone.
              </Trans>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteEntry.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {isConversation ? (
              <Trans>The conversation could not be deleted. Try again.</Trans>
            ) : (
              <Trans>The extraction could not be deleted. Try again.</Trans>
            )}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans>Cancel</Trans>
          </AlertDialogCancel>
          <Button variant="destructive" disabled={deleteEntry.isPending} onClick={handleDelete}>
            <Trans>Delete</Trans>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

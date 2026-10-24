import type { AgentParamsDto, ExtractionDocumentOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { toast } from "sonner"
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
import { useDeleteExtractionDocument } from "../api/mutations"

export type DeleteDocumentDialogProps = {
  agent: AgentParamsDto
  /** The document to delete; the dialog is open while there is one. */
  document: ExtractionDocumentOutputDto | null
  onClose: () => void
}

/** Asks before deleting a document the person uploaded; its past extractions stay. */
export function DeleteDocumentDialog({ agent, document, onClose }: DeleteDocumentDialogProps) {
  const { t } = useLingui()
  const deleteDocument = useDeleteExtractionDocument(agent)
  const name = document?.fileName ?? t`Untitled document`

  const handleDelete = () => {
    if (!document) return
    deleteDocument.mutate(document.id, {
      onSuccess: () => {
        onClose()
        toast.success(t`${name} was deleted.`)
      },
    })
  }

  return (
    <AlertDialog open={document !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>Delete this document?</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>
              "{name}" will no longer be offered for an extraction. Its past extractions stay in the
              history.
            </Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteDocument.isError ? (
          <p role="alert" className="text-sm text-destructive">
            <Trans>The document could not be deleted. Try again.</Trans>
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans>Cancel</Trans>
          </AlertDialogCancel>
          <Button variant="destructive" disabled={deleteDocument.isPending} onClick={handleDelete}>
            <Trans>Delete</Trans>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

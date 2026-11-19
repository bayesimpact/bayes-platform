import type { ConversationDatasetOutputDto, ProjectParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import {
  useCreateConversationDataset,
  useDeleteConversationDataset,
  useRenameConversationDataset,
} from "../api/mutations"
import { DatasetNameDialog } from "./DatasetNameDialog"

/** What a person does to a dataset through a dialog: create one, rename one or delete one. */
export type ConversationDatasetAction =
  | { kind: "create" }
  | { kind: "rename"; dataset: ConversationDatasetOutputDto }
  | { kind: "delete"; dataset: ConversationDatasetOutputDto }

export type ConversationDatasetDialogsProps = {
  project: ProjectParamsDto
  /** The action under way, or `null` while no dialog shows. */
  action: ConversationDatasetAction | null
  onClose: () => void
  /** Called once a dataset is deleted, for a page that showed it to leave. */
  onDeleted?: () => void
}

/** The dialogs that create, rename and delete a dataset, shared by the list and a dataset's page. */
export function ConversationDatasetDialogs({
  project,
  action,
  onClose,
  onDeleted,
}: ConversationDatasetDialogsProps) {
  const { t } = useLingui()
  const createDataset = useCreateConversationDataset(project)
  const renameDataset = useRenameConversationDataset(project)
  const deleteDataset = useDeleteConversationDataset(project)
  const deleted = action?.kind === "delete" ? action.dataset : null
  const deletedName = deleted?.name ?? ""
  return (
    <>
      {action?.kind === "create" ? (
        <DatasetNameDialog
          title={<Trans>New dataset</Trans>}
          description={<Trans>A dataset holds the questions an evaluation asks the agent.</Trans>}
          submitLabel={<Trans>Create dataset</Trans>}
          defaultName=""
          isPending={createDataset.isPending}
          onClose={onClose}
          onSubmit={(name) =>
            createDataset.mutate(
              { name },
              {
                onSuccess: () => {
                  toast.success(t`The dataset was created.`)
                  onClose()
                },
                onError: () => toast.error(t`The dataset could not be created. Try again.`),
              },
            )
          }
        />
      ) : null}
      {action?.kind === "rename" ? (
        <DatasetNameDialog
          title={<Trans>Rename the dataset</Trans>}
          description={<Trans>Its records and its runs keep their place.</Trans>}
          submitLabel={<Trans>Rename</Trans>}
          defaultName={action.dataset.name}
          isPending={renameDataset.isPending}
          onClose={onClose}
          onSubmit={(name) =>
            renameDataset.mutate(
              { datasetId: action.dataset.id, name },
              {
                onSuccess: () => {
                  toast.success(t`The dataset was renamed.`)
                  onClose()
                },
                onError: () => toast.error(t`The dataset could not be renamed. Try again.`),
              },
            )
          }
        />
      ) : null}
      <ConfirmDialog
        isOpen={deleted !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose()
        }}
        title={<Trans>Delete {deletedName}?</Trans>}
        description={<Trans>The dataset, its records and its runs are deleted for good.</Trans>}
        confirmLabel={<Trans>Delete</Trans>}
        isDestructive
        isPending={deleteDataset.isPending}
        onConfirm={() => {
          if (!deleted) return
          deleteDataset.mutate(deleted.id, {
            onSuccess: () => {
              toast.success(t`The dataset was deleted.`)
              onClose()
              onDeleted?.()
            },
            onError: () => toast.error(t`The dataset could not be deleted. Try again.`),
          })
        }}
      />
    </>
  )
}

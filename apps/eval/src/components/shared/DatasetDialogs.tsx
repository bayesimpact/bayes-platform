import { Trans, useLingui } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "./ConfirmDialog"
import { DatasetNameDialog } from "./DatasetNameDialog"
import type { MutationLike } from "./mutation-like"

/** The dataset an action is about: its id, and its name. */
type ActedDataset = { id: string; name: string }

/** What a person does to a dataset through a dialog: create one, rename one or delete one. */
export type DatasetAction =
  | { kind: "create" }
  | { kind: "rename"; dataset: ActedDataset }
  | { kind: "delete"; dataset: ActedDataset }

export type DatasetDialogsProps = {
  /** The action under way, or `null` while no dialog shows. */
  action: DatasetAction | null
  onClose: () => void
  /** Called once a dataset is deleted, for a page that showed it to leave. */
  onDeleted?: () => void
  /** What a dataset holds, said under the title of the dialog that names a new one. */
  createDescription: ReactNode
  createDataset: MutationLike<{ name: string }>
  renameDataset: MutationLike<{ datasetId: string; name: string }>
  /** Deletes a dataset, by its id. */
  deleteDataset: MutationLike<string>
}

/**
 * The dialogs that create, rename and delete a dataset, shared by the list and a dataset's page,
 * for the datasets of every type of agent: the feature gives the calls.
 */
export function DatasetDialogs({
  action,
  onClose,
  onDeleted,
  createDescription,
  createDataset,
  renameDataset,
  deleteDataset,
}: DatasetDialogsProps) {
  const { t } = useLingui()
  const deleted = action?.kind === "delete" ? action.dataset : null
  const deletedName = deleted?.name ?? ""
  return (
    <>
      {action?.kind === "create" ? (
        <DatasetNameDialog
          title={<Trans>New dataset</Trans>}
          description={createDescription}
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
